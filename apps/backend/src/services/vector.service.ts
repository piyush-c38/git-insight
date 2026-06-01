import { ChromaClient, Collection } from 'chromadb';
import { ApiError } from '../lib/errors';
import { LocalVectorStore } from '../lib/local-vector-store';
import config from '../config';
import { yieldToEventLoop } from '../lib/async-utils';

const CHROMA_INSERT_BATCH = 100;

type VectorDocument = {
  id: string;
  embedding: number[];
  document: string;
  metadata: Record<string, unknown>;
};

class VectorService {
  private mode: 'local' | 'remote';
  private client: ChromaClient | null = null;
  private localStore: LocalVectorStore | null = null;
  private collection: Collection | null = null;

  constructor() {
    if (config.chromaUrl) {
      this.mode = 'remote';
      this.client = new ChromaClient({ path: config.chromaUrl });
      console.log(`[chroma] Remote Chroma client: ${config.chromaUrl}`);
    } else {
      this.mode = 'local';
      this.localStore = new LocalVectorStore(config.chromaDataPath);
      console.log('[chroma] Embedded local mode (persistent disk storage, no CHROMA_URL required)');
    }
  }

  private async getOrCreateRemoteCollection(name: string): Promise<Collection> {
    if (!this.client) {
      throw new ApiError(500, 'Chroma client is not configured');
    }

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

  async addDocuments(collectionName: string, documents: VectorDocument[]) {
    if (this.mode === 'local') {
      return this.addDocumentsLocal(collectionName, documents);
    }
    return this.addDocumentsRemote(collectionName, documents);
  }

  private addDocumentsLocal(collectionName: string, documents: VectorDocument[]) {
    if (!this.localStore) {
      throw new ApiError(500, 'Local vector store is not initialized');
    }

    console.time('Chroma Vector Insertion');
    try {
      this.localStore.addRecords(
        collectionName,
        documents.map((doc) => ({
          id: doc.id,
          embedding: doc.embedding,
          document: doc.document,
          metadata: doc.metadata,
        }))
      );
      console.timeEnd('Chroma Vector Insertion');
      console.log(`[perf] Inserted ${documents.length} vectors into local collection "${collectionName}"`);
    } catch (error) {
      console.timeEnd('Chroma Vector Insertion');
      console.error('Failed to add documents to local vector store:', error);
      throw new ApiError(500, 'Failed to add documents to vector store');
    }
  }

  private async addDocumentsRemote(collectionName: string, documents: VectorDocument[]) {
    if (!this.collection || this.collection.name !== collectionName) {
      this.collection = await this.getOrCreateRemoteCollection(collectionName);
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
          metadatas: batch.map((doc) => doc.metadata) as any,
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
    if (this.mode === 'local') {
      return this.queryLocal(collectionName, queryEmbedding, nResults);
    }
    return this.queryRemote(collectionName, queryEmbedding, nResults);
  }

  private queryLocal(collectionName: string, queryEmbedding: number[], nResults: number) {
    if (!this.localStore) {
      throw new ApiError(500, 'Local vector store is not initialized');
    }

    console.time('Chroma Query');
    try {
      const results = this.localStore.query(collectionName, queryEmbedding, nResults);
      console.timeEnd('Chroma Query');
      const hitCount = Array.isArray(results.documents?.[0]) ? results.documents[0].length : 0;
      console.log(`[perf] Local vector query returned ${hitCount} results from collection "${collectionName}"`);
      return results;
    } catch (error) {
      console.timeEnd('Chroma Query');
      console.error('Failed to query local vector store:', error);
      throw new ApiError(500, 'Failed to query vector store');
    }
  }

  private async queryRemote(collectionName: string, queryEmbedding: number[], nResults: number) {
    if (!this.collection || this.collection.name !== collectionName) {
      this.collection = await this.getOrCreateRemoteCollection(collectionName);
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
