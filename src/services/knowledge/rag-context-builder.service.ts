import { VectorSearchResult } from './vector-search.service';

export class RAGContextBuilder {
  /**
   * Formats and combines retrieved knowledge chunks into a coherent context block for LLM generation.
   * Groups chunks by document and sorts them by original chunkNumber to preserve natural sentence flow.
   */
  buildContext(chunks: VectorSearchResult[]): string {
    if (!chunks || chunks.length === 0) {
      return '';
    }

    // 1. Group chunks by documentId
    const docMap = new Map<
      string,
      {
        documentTitle: string;
        documentCategory: string;
        topSimilarity: number;
        chunks: VectorSearchResult[];
      }
    >();

    chunks.forEach((chunk) => {
      if (!docMap.has(chunk.documentId)) {
        docMap.set(chunk.documentId, {
          documentTitle: chunk.documentTitle,
          documentCategory: chunk.documentCategory || '',
          topSimilarity: chunk.similarity,
          chunks: [],
        });
      }
      const group = docMap.get(chunk.documentId)!;
      group.chunks.push(chunk);
      if (chunk.similarity > group.topSimilarity) {
        group.topSimilarity = chunk.similarity;
      }
    });

    // 2. Sort document groups by top similarity score descending
    const sortedDocGroups = Array.from(docMap.values()).sort(
      (a, b) => b.topSimilarity - a.topSimilarity
    );

    // 3. Construct coherent source blocks
    const sourceBlocks = sortedDocGroups.map((group, index) => {
      const sourceNum = index + 1;
      const categoryInfo = group.documentCategory ? ` (Category: ${group.documentCategory})` : '';

      // Sort chunks within document by chunkNumber ascending
      const sortedChunks = [...group.chunks].sort((a, b) => a.chunkNumber - b.chunkNumber);

      // Combine text content sequentially
      const combinedText = sortedChunks
        .map((c) => c.chunkText.trim())
        .filter((text, i, arr) => text.length > 0 && (i === 0 || text !== arr[i - 1]))
        .join('\n\n');

      return `SOURCE ${sourceNum}:
Document: ${group.documentTitle}${categoryInfo}
Content:
${combinedText}`;
    });

    return sourceBlocks.join('\n\n---\n\n');
  }
}
