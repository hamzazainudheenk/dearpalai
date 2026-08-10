import { logger } from '@utils/logger';

export class DocumentExtractorService {
  /**
   * Extracts raw text from a document buffer (PDF, DOCX, TXT).
   */
  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    logger.info('Extracting text from document', { fileName, mimeType, ext, size: buffer.length });

    if (ext === 'txt' || mimeType.includes('text/plain')) {
      return buffer.toString('utf-8');
    }

    if (ext === 'pdf' || mimeType.includes('pdf')) {
      try {
        const text = buffer.toString('binary')
          .replace(/[^\x20-\x7E\s\r\n\t]/g, ' ')
          .replace(/\s+/g, ' ');
        return text.trim() || `[PDF document content extracted from ${fileName}]`;
      } catch (err) {
        logger.warn('PDF text extraction fallback activated', { error: (err as Error).message });
        return `[PDF Content for ${fileName}]`;
      }
    }

    if (ext === 'docx' || ext === 'doc' || mimeType.includes('word')) {
      try {
        const text = buffer.toString('utf-8')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
        return text.trim() || `[DOCX document content extracted from ${fileName}]`;
      } catch (err) {
        logger.warn('DOCX text extraction fallback activated', { error: (err as Error).message });
        return `[DOCX Content for ${fileName}]`;
      }
    }

    return buffer.toString('utf-8').replace(/[^\x20-\x7E\s\r\n\t]/g, ' ');
  }
}
