import { logger } from '@utils/logger';

export interface ChunkResult {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export class ChunkerService {
  /**
   * Cleans raw extracted text and splits it into semantic chunks for RAG processing.
   *
   * @param rawText - Extracted text
   * @param chunkSize - Maximum characters per chunk (default: 800)
   * @param overlap - Character overlap between chunks (default: 100)
   */
  chunkText(rawText: string, chunkSize = 800, overlap = 100): ChunkResult[] {
    if (!rawText || !rawText.trim()) {
      return [];
    }

    // Clean whitespace
    const cleanedText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const chunks: ChunkResult[] = [];
    let start = 0;
    let index = 0;

    while (start < cleanedText.length) {
      const end = Math.min(start + chunkSize, cleanedText.length);
      let slice = cleanedText.slice(start, end);

      // Avoid breaking words if possible
      if (end < cleanedText.length) {
        const lastSpace = slice.lastIndexOf(' ');
        if (lastSpace > chunkSize * 0.6) {
          slice = slice.slice(0, lastSpace);
        }
      }

      const trimmedContent = slice.trim();
      if (trimmedContent) {
        const wordCount = trimmedContent.split(/\s+/).length;
        chunks.push({
          chunkIndex: index,
          content: trimmedContent,
          tokenCount: Math.ceil(wordCount * 1.3), // Approximate token estimation
        });
        index++;
      }

      start += Math.max(slice.length - overlap, 1);
    }

    logger.info('Text chunking complete', { totalChars: cleanedText.length, totalChunks: chunks.length });
    return chunks;
  }
}
