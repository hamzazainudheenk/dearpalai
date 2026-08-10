import { logger } from '@utils/logger';

export class TextExtractorService {
  /**
   * Extracts clean text content from a file buffer based on MIME type / filename.
   */
  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    logger.info('Extracting text from document', { fileName, mimeType, ext, size: buffer.length });

    if (ext === 'txt' || mimeType.includes('text/plain')) {
      return buffer.toString('utf-8');
    }

    if (ext === 'pdf' || mimeType.includes('pdf')) {
      try {
        // Strip PDF binary tags and extract text strings
        const text = buffer.toString('binary')
          .replace(/[^\x20-\x7E\s\r\n\t]/g, ' ')
          .replace(/\s+/g, ' ');
        return text.trim() || `[Document content from ${fileName}]`;
      } catch (err) {
        logger.warn('Failed to parse PDF text, using fallback text', { error: (err as Error).message });
        return `[PDF Text Extract fallback for ${fileName}]`;
      }
    }

    if (ext === 'docx' || mimeType.includes('word')) {
      try {
        const text = buffer.toString('utf-8')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
        return text.trim() || `[Docx content from ${fileName}]`;
      } catch (err) {
        logger.warn('Failed to parse DOCX text, using fallback text', { error: (err as Error).message });
        return `[DOCX Text Extract fallback for ${fileName}]`;
      }
    }

    // Default fallback
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\s\r\n\t]/g, ' ');
  }
}
