import { ChromaClient, Collection } from 'chromadb';
import { ApiError } from '../lib/errors';
import config from '../config';
import { yieldToEventLoop } from '../lib/async-utils';

const CHROMA_INSERT_BATCH = 100;

class VectorService {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor() {
    if (!config.chromaUrl) {
      throw new ApiError(500, 'CHROMA_URL is not configured');
    }
    this.client = new ChromaClient({ path: config.chromaUrl });
  }

  async getOrCreateCollection(name: string): Promise<Collection> {
    console.time('Chroma Collection Creation');
    try {
      this.collection = await this.client.getOrCreateCollection({ name });
      console.timeEnd('Chroma Collection Creation');
      return this.collection;
    } catch (error) {
      console.timeEnd('Chroma Collection Creation');
      console.error('Failed to get or create collection:', error);
      throw new ApiError(500, 'Failed to get or create ChromaDB collection');
    }
  }

  async addDocuments(
    collectionName: string,
    documents: { id: string; embedding: number[]; document: string; metadata: any }[]
  ) {
    if (!this.collection || this.collection.name !== collectionName) {
      this.collection = await this.getOrCreateCollection(collectionName);
    }

    console.time('Chroma Vector Insertion');
    try {
      let inserted = 0;
      for (let offset = 0; offset < documents.length; offset += CHROMA_INSERT_BATCH) {
        const batch = documents.slice(offset, offset + CHROMA_INSERT_BATCH);
        await this.collection.add({
          ids: batch.map((doc) => doc.id),
          embeddings: batch.map((doc) => doc.embedding),
          documents: batch.map((doc) => doc.document),
          metadatas: batch.map((doc) => doc.metadata),
        });
        inserted += batch.length;
        await yieldToEventLoop();
      }
      console.timeEnd('Chroma Vector Insertion');
      console.log(`[perf] Inserted ${inserted} vectors into Chroma collection "${collectionName}"`);
    } catch (error) {
      console.timeEnd('Chroma Vector Insertion');
      console.error('Failed to add documents to ChromaDB:', error);
      throw new ApiError(500, 'Failed to add documents to ChromaDB');
    }
  }

  async query(collectionName: string, queryEmbedding: number[], nResults = 5) {
    if (!this.collection || this.collection.name !== collectionName) {
      this.collection = await this.getOrCreateCollection(collectionName);
    }

    console.time('Chroma Query');
    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ['documents', 'metadatas', 'distances'] as any,
      });
      console.timeEnd('Chroma Query');
      const hitCount = Array.isArray(results.documents?.[0]) ? results.documents[0].length : 0;
      console.log(`[perf] Chroma query returned ${hitCount} results from collection "${collectionName}"`);
      return results;
    } catch (error) {
      console.timeEnd('Chroma Query');
      console.error('Failed to query ChromaDB:', error);
      throw new ApiError(500, 'Failed to query ChromaDB');
    }
  }
}

export const vectorService = new VectorService();
