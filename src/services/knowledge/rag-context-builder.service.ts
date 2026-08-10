import { VectorSearchResult } from './vector-search.service';

export class RAGContextBuilder {
  /**
   * Formats retrieved knowledge chunks into a clean, structured context block for LLM prompts.
   */
  buildContext(chunks: VectorSearchResult[]): string {
    if (!chunks || chunks.length === 0) {
      return '';
    }

    const sourceBlocks = chunks.map((chunk, index) => {
      const sourceNum = index + 1;
      const categoryInfo = chunk.documentCategory ? ` (Category: ${chunk.documentCategory})` : '';
      return `SOURCE ${sourceNum}:
Document: ${chunk.documentTitle}${categoryInfo}
Content:
${chunk.chunkText.trim()}`;
    });

    return sourceBlocks.join('\n\n---\n\n');
  }
}
