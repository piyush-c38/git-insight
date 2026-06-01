import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';

// Skip local model check
env.allowLocalModels = false;

class EmbeddingService {
  private pipe: any;

  constructor() {
    this.init();
  }

  private async init() {
    this.pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async generateEmbeddings(text: string): Promise<number[]> {
    if (!this.pipe) {
      await this.init();
    }
    const result = await this.pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  async generateEmbeddingsForFiles(
    filePaths: string[],
    shouldStop?: () => boolean
  ): Promise<{ filePath: string; content: string; embedding: number[] }[]> {
    const embeddings = [];
    for (const filePath of filePaths) {
      if (shouldStop?.()) {
        break;
      }

      const rawContent = fs.readFileSync(filePath, 'utf-8');
      if (rawContent.includes('\u0000')) {
        continue;
      }
      const content = this.sanitizeText(rawContent);
      // Simple chunking for now
      const chunks = this.chunkText(content);
      for (const chunk of chunks) {
        if (shouldStop?.()) {
          break;
        }

        const embedding = await this.generateEmbeddings(chunk);
        embeddings.push({ filePath, content: chunk, embedding });
      }
    }
    return embeddings;
  }

  private sanitizeText(text: string): string {
    const withoutControls = text.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ''
    );

    const escapedBackslashes = withoutControls.replace(/\\/g, '\\\\');
    return escapedBackslashes.replace(/\\x[0-9A-Fa-f]{0,2}/g, '');
  }

  private chunkText(text: string, chunkSize = 512, overlap = 50): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }
}

export const embeddingService = new EmbeddingService();
