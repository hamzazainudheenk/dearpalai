import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@config/supabase';
import { TextExtractorService } from './text-extractor.service';
import { ChunkerService } from './chunker.service';
import { logger } from '@utils/logger';

export interface KnowledgeDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  status: 'processing' | 'completed' | 'failed';
  total_chunks: number;
  created_at: string;
  updated_at: string;
  approved_doctors_count?: number;
}

export interface DocumentQueryParams {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class KnowledgeService {
  private textExtractor = new TextExtractorService();
  private chunker = new ChunkerService();
  private readonly bucketName = 'knowledge-base';

  /**
   * Ensures the knowledge-base Supabase Storage bucket exists.
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === this.bucketName);

      if (!exists) {
        logger.info(`Creating Supabase storage bucket '${this.bucketName}'...`);
        await supabaseAdmin.storage.createBucket(this.bucketName, {
          public: false,
        });
      }
    } catch (err) {
      logger.warn('Error checking/creating storage bucket', { error: (err as Error).message });
    }
  }

  /**
   * Uploads a document to Supabase storage and initiates background processing.
   */
  async uploadDocument(
    file: Express.Multer.File,
    title: string,
    description: string,
    category: string
  ): Promise<KnowledgeDocument> {
    await this.ensureBucketExists();

    const documentId = uuidv4();
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `documents/${documentId}/${cleanFileName}`;

    logger.info('Uploading knowledge document to storage', {
      documentId,
      fileName: file.originalname,
      storagePath,
      size: file.size,
    });

    // 1. Upload file to Supabase Storage bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from(this.bucketName)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      logger.error('Failed to upload file to Supabase storage', { error: uploadError.message });
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 2. Insert record into knowledge_documents
    const { data: document, error: dbError } = await supabaseAdmin
      .from('knowledge_documents')
      .insert({
        id: documentId,
        title: title.trim(),
        description: description?.trim() || '',
        category: category.trim(),
        file_name: file.originalname,
        storage_path: storagePath,
        mime_type: file.mimetype,
        file_size: file.size,
        status: 'processing',
        total_chunks: 0,
      })
      .select()
      .single();

    if (dbError || !document) {
      logger.error('Failed to insert knowledge document into database', { error: dbError?.message });
      // Attempt cleanup
      await supabaseAdmin.storage.from(this.bucketName).remove([storagePath]);
      throw new Error(`Database insert failed: ${dbError?.message}`);
    }

    // 3. Fire-and-forget processing pipeline asynchronously
    setImmediate(() => {
      this.processDocument(documentId, file.buffer, file.mimetype, file.originalname).catch((err) => {
        logger.error('Async processDocument error', { documentId, error: (err as Error).message });
      });
    });

    return document as KnowledgeDocument;
  }

  /**
   * Processes a document: extracts text, chunks it, and stores chunks in DB.
   */
  async processDocument(
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<void> {
    logger.info('Processing knowledge document', { documentId, fileName });

    try {
      // Set status to processing
      await supabaseAdmin
        .from('knowledge_documents')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', documentId);

      // Extract text
      const extractedText = await this.textExtractor.extractText(buffer, mimeType, fileName);

      // Create chunks
      const chunks = this.chunker.chunkText(extractedText);

      // Delete existing chunks if reprocessing
      await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', documentId);

      // Insert new chunks if any
      if (chunks.length > 0) {
        const chunkRecords = chunks.map((c) => ({
          document_id: documentId,
          chunk_index: c.chunkIndex,
          content: c.content,
          token_count: c.tokenCount,
          metadata: { fileName, documentId },
        }));

        const { error: chunkError } = await supabaseAdmin.from('knowledge_chunks').insert(chunkRecords);

        if (chunkError) {
          throw new Error(`Failed to insert chunks: ${chunkError.message}`);
        }
      }

      // Mark completed
      await supabaseAdmin
        .from('knowledge_documents')
        .update({
          status: 'completed',
          total_chunks: chunks.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      logger.info('Document processing completed successfully', { documentId, chunksCount: chunks.length });
    } catch (err) {
      logger.error('Document processing failed', { documentId, error: (err as Error).message });

      await supabaseAdmin
        .from('knowledge_documents')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);
    }
  }

  /**
   * Gets paginated knowledge documents matching optional search/category/status filters,
   * plus overall summary stats for dashboard cards.
   */
  async getDocuments(params: DocumentQueryParams) {
    const search = params.search?.trim() || '';
    const category = params.category || '';
    const status = params.status || '';
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const offset = (page - 1) * limit;

    // Base query
    let query = supabaseAdmin
      .from('knowledge_documents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,file_name.ilike.%${search}%`);
    }
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    if (status && status !== 'All') {
      query = query.eq('status', status.toLowerCase());
    }

    query = query.range(offset, offset + limit - 1);

    const { data: documents, count: total, error } = await query;

    if (error) {
      logger.error('Failed to fetch knowledge documents', { error: error.message });
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    // Attach doctor approvals count for each document
    const docIds = (documents || []).map((d) => d.id);
    const approvalCountsMap: Record<string, number> = {};

    if (docIds.length > 0) {
      const { data: approvals } = await supabaseAdmin
        .from('doctor_knowledge_approvals')
        .select('document_id');

      (approvals || []).forEach((a) => {
        approvalCountsMap[a.document_id] = (approvalCountsMap[a.document_id] || 0) + 1;
      });
    }

    const formattedDocs = (documents || []).map((d) => ({
      ...d,
      approved_doctors_count: approvalCountsMap[d.id] || 0,
    }));

    // Aggregate summary stats for header cards
    const { data: allDocs } = await supabaseAdmin.from('knowledge_documents').select('status, total_chunks');
    const { count: totalApprovals } = await supabaseAdmin
      .from('doctor_knowledge_approvals')
      .select('*', { count: 'exact', head: true });

    let totalDocsCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let totalChunksSum = 0;

    (allDocs || []).forEach((d) => {
      totalDocsCount++;
      if (d.status === 'processing') processingCount++;
      if (d.status === 'completed') completedCount++;
      if (d.status === 'failed') failedCount++;
      totalChunksSum += d.total_chunks || 0;
    });

    return {
      data: formattedDocs,
      meta: {
        total: total || 0,
        page,
        limit,
        totalPages: total ? Math.ceil(total / limit) : 1,
      },
      stats: {
        totalDocuments: totalDocsCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
        totalChunks: totalChunksSum,
        totalDoctorApprovals: totalApprovals || 0,
      },
    };
  }

  /**
   * Retrieves single document by ID with chunk preview & approval count.
   */
  async getDocumentById(id: string) {
    const { data: document, error } = await supabaseAdmin
      .from('knowledge_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      throw new Error('Document not found');
    }

    const { data: chunks } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('*')
      .eq('document_id', id)
      .order('chunk_index', { ascending: true })
      .limit(20);

    const { count: approvedCount } = await supabaseAdmin
      .from('doctor_knowledge_approvals')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', id);

    return {
      ...document,
      approved_doctors_count: approvedCount || 0,
      chunks: chunks || [],
    };
  }

  /**
   * Deletes a document: deletes storage file, chunks, doctor approvals, and document DB record.
   */
  async deleteDocument(id: string): Promise<void> {
    logger.info('Deleting knowledge document', { id });

    // 1. Fetch document to get storage_path
    const { data: doc } = await supabaseAdmin
      .from('knowledge_documents')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();

    if (doc?.storage_path) {
      // Delete file from Supabase storage
      await supabaseAdmin.storage.from(this.bucketName).remove([doc.storage_path]);
    }

    // 2. Delete chunks and approvals
    await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', id);
    await supabaseAdmin.from('doctor_knowledge_approvals').delete().eq('document_id', id);

    // 3. Delete document record
    const { error } = await supabaseAdmin.from('knowledge_documents').delete().eq('id', id);

    if (error) {
      logger.error('Failed to delete document from database', { id, error: error.message });
      throw new Error(`Failed to delete document: ${error.message}`);
    }

    logger.info('Knowledge document deleted successfully', { id });
  }

  /**
   * Reprocesses an existing document by re-downloading its file from storage and re-running processing.
   */
  async reprocessDocument(id: string): Promise<KnowledgeDocument> {
    logger.info('Reprocessing knowledge document', { id });

    const { data: doc, error } = await supabaseAdmin
      .from('knowledge_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !doc) {
      throw new Error('Document not found for reprocessing');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(this.bucketName)
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file from storage: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Trigger processing
    setImmediate(() => {
      this.processDocument(id, buffer, doc.mime_type, doc.file_name).catch((err) => {
        logger.error('Async reprocessDocument error', { id, error: (err as Error).message });
      });
    });

    return doc as KnowledgeDocument;
  }
}
