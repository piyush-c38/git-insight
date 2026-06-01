import type { CodeChunk } from './chunk.service';
import {
  embeddingPoolService,
  type EmbeddingProgress,
  type EmbeddingRecord,
} from './embedding-pool.service';

export type EmbeddingBatchResult = {
  embeddings: EmbeddingRecord[];
  chunksGenerated: number;
};

class EmbeddingService {
  async generateEmbeddings(text: string): Promise<number[]> {
    console.time('Embedding Generation');
    const embedding = await embeddingPoolService.embedQuery(text);
    console.timeEnd('Embedding Generation');
    return embedding;
  }

  async generateEmbeddingsForChunks(
    chunks: CodeChunk[],
    shouldStop?: () => boolean,
    onProgress?: (progress: EmbeddingProgress) => void
  ): Promise<EmbeddingBatchResult> {
    const embeddings = await embeddingPoolService.embedChunks(chunks, shouldStop, onProgress);
    return {
      embeddings,
      chunksGenerated: chunks.length,
    };
  }
}

export const embeddingService = new EmbeddingService();
