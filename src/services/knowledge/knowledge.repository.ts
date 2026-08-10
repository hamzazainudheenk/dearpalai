import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';

export interface KnowledgeDocumentRecord {
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
}

export class KnowledgeRepository {
  /**
   * Inserts a new document record.
   */
  async createDocument(data: Partial<KnowledgeDocumentRecord>): Promise<KnowledgeDocumentRecord> {
    const { data: doc, error } = await supabaseAdmin
      .from('knowledge_documents')
      .insert(data)
      .select()
      .single();

    if (error || !doc) {
      logger.error('Database createDocument error', { error: error?.message });
      throw new Error(`Failed to create document record: ${error?.message}`);
    }

    return doc as KnowledgeDocumentRecord;
  }

  /**
   * Updates document status and metadata.
   */
  async updateDocumentStatus(
    id: string,
    status: 'processing' | 'completed' | 'failed',
    totalChunks?: number
  ): Promise<void> {
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (typeof totalChunks === 'number') {
      updatePayload.total_chunks = totalChunks;
    }

    const { error } = await supabaseAdmin
      .from('knowledge_documents')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      logger.error('Database updateDocumentStatus error', { id, status, error: error.message });
    }
  }

  /**
   * Retrieves single document by ID.
   */
  async getDocumentById(id: string): Promise<KnowledgeDocumentRecord | null> {
    const { data: doc } = await supabaseAdmin
      .from('knowledge_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return doc as KnowledgeDocumentRecord | null;
  }

  /**
   * Deletes document, chunks, and doctor approval relationships.
   */
  async deleteDocument(id: string): Promise<void> {
    await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', id);
    await supabaseAdmin.from('doctor_knowledge').delete().eq('document_id', id);
    await supabaseAdmin.from('doctor_knowledge_approvals').delete().eq('document_id', id);

    const { error } = await supabaseAdmin.from('knowledge_documents').delete().eq('id', id);

    if (error) {
      logger.error('Database deleteDocument error', { id, error: error.message });
      throw new Error(`Failed to delete document from DB: ${error.message}`);
    }
  }

  /**
   * Stores chunks with vector embeddings in knowledge_chunks table.
   */
  async storeChunks(
    documentId: string,
    chunks: { chunkIndex: number; content: string; tokenCount: number; embedding?: number[] }[],
    fileName: string
  ): Promise<void> {
    // Delete old chunks first if reprocessing
    await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', documentId);

    if (chunks.length === 0) return;

    const records = chunks.map((c) => ({
      document_id: documentId,
      chunk_index: c.chunkIndex,
      content: c.content,
      token_count: c.tokenCount,
      embedding: c.embedding ? JSON.stringify(c.embedding) : null,
      metadata: { fileName, documentId },
    }));

    const { error } = await supabaseAdmin.from('knowledge_chunks').insert(records);

    if (error) {
      logger.error('Database storeChunks error', { documentId, error: error.message });
      throw new Error(`Failed to store knowledge chunks: ${error.message}`);
    }
  }

  /**
   * Retrieves chunks for a document.
   */
  async getChunksByDocumentId(documentId: string, limit = 50) {
    const { data } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
      .limit(limit);

    return data || [];
  }

  /**
   * Retrieves count of doctor approvals for a document.
   */
  async getApprovalCount(documentId: string): Promise<number> {
    const { count } = await supabaseAdmin
      .from('doctor_knowledge')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('approved', true);

    if (typeof count === 'number') return count;

    // Fallback check on doctor_knowledge_approvals table if present
    const { count: fallbackCount } = await supabaseAdmin
      .from('doctor_knowledge_approvals')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);

    return fallbackCount || 0;
  }
}
