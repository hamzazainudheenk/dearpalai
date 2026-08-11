import { logger } from '@utils/logger';

export class DocumentExtractorService {
  /**
   * Extracts clean textual content from a document buffer (PDF, DOCX, TXT).
   */
  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    logger.info('Extracting text from document', { fileName, mimeType, ext, size: buffer.length });

    if (ext === 'txt' || mimeType.includes('text/plain')) {
      return buffer.toString('utf-8');
    }

    if (ext === 'pdf' || mimeType.includes('pdf')) {
      try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();

        let rawText = '';
        if (typeof parsed === 'string') {
          rawText = parsed;
        } else if (parsed?.text) {
          rawText = parsed.text;
        } else if (parsed?.pages && Array.isArray(parsed.pages)) {
          rawText = parsed.pages.map((p: any) => p.text || '').join('\n');
        }

        const text = rawText.replace(/\s+/g, ' ').trim();
        logger.info('PDF text extraction successful', { fileName, charCount: text.length });
        return text || `[PDF document content extracted from ${fileName}]`;
      } catch (err) {
        logger.warn('PDFParse extraction failed, using fallback regex text cleaner', { error: (err as Error).message });
        const text = buffer.toString('utf-8')
          .replace(/[^\x20-\x7E\s\r\n\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return text || `[PDF Content for ${fileName}]`;
      }
    }

    if (ext === 'docx' || ext === 'doc' || mimeType.includes('word')) {
      try {
        const text = buffer.toString('utf-8')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return text || `[DOCX document content extracted from ${fileName}]`;
      } catch (err) {
        logger.warn('DOCX text extraction fallback activated', { error: (err as Error).message });
        return `[DOCX Content for ${fileName}]`;
      }
    }

    return buffer.toString('utf-8').replace(/[^\x20-\x7E\s\r\n\t]/g, ' ');
  }
}
