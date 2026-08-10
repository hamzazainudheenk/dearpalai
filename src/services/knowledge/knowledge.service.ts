import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@config/supabase';
import { KnowledgeRepository, KnowledgeDocumentRecord } from './knowledge.repository';
import { DocumentProcessingService } from './document-processing.service';
import { logger } from '@utils/logger';

export interface KnowledgeDocument extends KnowledgeDocumentRecord {
  approved_doctors_count?: number;
  chunks?: any[];
}

export interface DocumentQueryParams {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class KnowledgeService {
  private repository = new KnowledgeRepository();
  private processingService = new DocumentProcessingService();
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
        await supabaseAdmin.storage.createBucket(this.bucketName, { public: false });
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

    // 2. Insert record into knowledge_documents via KnowledgeRepository
    const document = await this.repository.createDocument({
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
    });

    // 3. Fire-and-forget background processing via DocumentProcessingService
    setImmediate(() => {
      this.processingService
        .process(documentId, storagePath, file.mimetype, file.originalname, file.buffer)
        .catch((err) => {
          logger.error('Async process error in uploadDocument', { documentId, error: (err as Error).message });
        });
    });

    return document;
  }

  /**
   * Gets paginated knowledge documents matching search/category/status filters,
   * plus overall summary stats.
   */
  async getDocuments(params: DocumentQueryParams) {
    const search = params.search?.trim() || '';
    const category = params.category || '';
    const status = params.status || '';
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const offset = (page - 1) * limit;

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
      await Promise.all(
        docIds.map(async (docId) => {
          approvalCountsMap[docId] = await this.repository.getApprovalCount(docId);
        })
      );
    }

    const formattedDocs = (documents || []).map((d) => ({
      ...d,
      approved_doctors_count: approvalCountsMap[d.id] || 0,
    }));

    // Aggregate summary stats for header cards
    const { data: allDocs } = await supabaseAdmin.from('knowledge_documents').select('status, total_chunks');
    const { count: totalApprovals } = await supabaseAdmin
      .from('doctor_knowledge')
      .select('*', { count: 'exact', head: true })
      .eq('approved', true);

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
    const document = await this.repository.getDocumentById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    const chunks = await this.repository.getChunksByDocumentId(id, 20);
    const approvedCount = await this.repository.getApprovalCount(id);

    return {
      ...document,
      approved_doctors_count: approvedCount,
      chunks,
    };
  }

  /**
   * Deletes a document: removes file from Supabase storage and deletes repository records.
   */
  async deleteDocument(id: string): Promise<void> {
    logger.info('Deleting knowledge document', { id });

    const doc = await this.repository.getDocumentById(id);
    if (doc?.storage_path) {
      await supabaseAdmin.storage.from(this.bucketName).remove([doc.storage_path]);
    }

    await this.repository.deleteDocument(id);
    logger.info('Knowledge document deleted successfully', { id });
  }

  /**
   * Reprocesses an existing document.
   */
  async reprocessDocument(id: string): Promise<KnowledgeDocument> {
    logger.info('Reprocessing knowledge document', { id });

    const doc = await this.repository.getDocumentById(id);
    if (!doc) {
      throw new Error('Document not found for reprocessing');
    }

    setImmediate(() => {
      this.processingService
        .process(id, doc.storage_path, doc.mime_type, doc.file_name)
        .catch((err) => {
          logger.error('Async process error in reprocessDocument', { id, error: (err as Error).message });
        });
    });

    return doc;
  }
}
