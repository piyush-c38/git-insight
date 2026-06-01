import fs from 'fs';
import path from 'path';

export type LocalVectorRecord = {
  id: string;
  embedding: number[];
  document: string;
  metadata: Record<string, unknown>;
};

type CollectionFile = {
  name: string;
  records: LocalVectorRecord[];
};

export type LocalQueryResult = {
  documents: (string | null)[][];
  metadatas: (Record<string, unknown> | null)[][];
  distances: number[][];
};

function sanitizeCollectionFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

function l2SquaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }
  return sum;
}

/**
 * File-backed vector store for single-process deployments (Railway, local).
 * Matches Chroma query response shape used by rag.service.ts.
 */
export class LocalVectorStore {
  constructor(private readonly dataDir: string) {
    fs.mkdirSync(this.dataDir, { recursive: true });
    console.log(`[chroma] Local persistent vector store: ${this.dataDir}`);
  }

  private collectionFilePath(collectionName: string): string {
    return path.join(this.dataDir, `${sanitizeCollectionFileName(collectionName)}.json`);
  }

  private loadCollection(collectionName: string): CollectionFile {
    const filePath = this.collectionFilePath(collectionName);
    if (!fs.existsSync(filePath)) {
      return { name: collectionName, records: [] };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as CollectionFile;
      if (!Array.isArray(parsed.records)) {
        return { name: collectionName, records: [] };
      }
      return { name: collectionName, records: parsed.records };
    } catch (error) {
      console.warn(`[chroma] Failed to read collection file ${filePath}:`, error);
      return { name: collectionName, records: [] };
    }
  }

  private saveCollection(collection: CollectionFile): void {
    const filePath = this.collectionFilePath(collection.name);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(collection));
    fs.renameSync(tempPath, filePath);
  }

  addRecords(collectionName: string, records: LocalVectorRecord[]): void {
    const collection = this.loadCollection(collectionName);
    const byId = new Map(collection.records.map((record) => [record.id, record]));

    for (const record of records) {
      byId.set(record.id, record);
    }

    collection.records = Array.from(byId.values());
    this.saveCollection(collection);
  }

  query(collectionName: string, queryEmbedding: number[], nResults: number): LocalQueryResult {
    const collection = this.loadCollection(collectionName);

    const ranked = collection.records
      .map((record) => ({
        record,
        distance: l2SquaredDistance(queryEmbedding, record.embedding),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, nResults);

    return {
      documents: [ranked.map((item) => item.record.document)],
      metadatas: [ranked.map((item) => item.record.metadata)],
      distances: [ranked.map((item) => item.distance)],
    };
  }
}
