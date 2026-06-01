import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { yieldToEventLoop } from '../lib/async-utils';
import { logProcessMemory } from '../lib/memory';
import type { CodeChunk } from './chunk.service';

export type EmbeddingRecord = {
  filePath: string;
  content: string;
  embedding: number[];
  symbolName?: string;
  symbolType?: string;
};

export type EmbeddingProgress = {
  chunksProcessed: number;
  chunksTotal: number;
};

type PendingRequest = {
  resolve: (embeddings: number[][]) => void;
  reject: (error: Error) => void;
};

type WorkerSlot = {
  worker: Worker;
  busy: boolean;
};

/** Default 1 worker to stay within Render 512MB (each worker loads its own ONNX model). */
const WORKER_COUNT = Math.max(1, Math.min(4, Number(process.env.EMBEDDING_WORKERS) || 1));
const BATCH_SIZE = Math.max(1, Number(process.env.EMBEDDING_BATCH_SIZE) || 8);

function resolveWorkerScript(): { scriptPath: string; execArgv?: string[] } {
  const compiledPath = path.join(__dirname, '../workers/embedding.worker.js');
  if (fs.existsSync(compiledPath)) {
    return { scriptPath: compiledPath };
  }

  const sourcePath = path.join(__dirname, '../workers/embedding.worker.ts');
  if (fs.existsSync(sourcePath)) {
    return {
      scriptPath: sourcePath,
      execArgv: ['-r', 'ts-node/register'],
    };
  }

  throw new Error('Embedding worker script was not found. Run `npm run build` in apps/backend.');
}

class EmbeddingPoolService {
  private workers: WorkerSlot[] = [];
  private readyPromise: Promise<void> | null = null;
  private pendingByWorker = new Map<Worker, PendingRequest>();
  private requestCounter = 0;

  private async ensureWorkers(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      logProcessMemory('embedding pool before worker spawn');
      const { scriptPath, execArgv } = resolveWorkerScript();
      let readyCount = 0;
      let startupError: Error | null = null;

      for (let index = 0; index < WORKER_COUNT; index += 1) {
        const worker = new Worker(scriptPath, execArgv ? { execArgv } : undefined);
        const slot: WorkerSlot = { worker, busy: false };
        this.workers.push(slot);

        worker.on('message', (message: { type: string; id?: string; embeddings?: number[][]; message?: string }) => {
          if (message.type === 'ready') {
            readyCount += 1;
            if (readyCount === WORKER_COUNT) {
              logProcessMemory('embedding pool after worker spawn (model loads lazily on first embed)');
              console.log(
                `[perf] Embedding worker pool ready (${WORKER_COUNT} worker(s), batch size ${BATCH_SIZE}, lazy model init)`
              );
              resolve();
            }
            return;
          }

          const pending = this.pendingByWorker.get(worker);
          if (!pending) return;

          this.pendingByWorker.delete(worker);
          slot.busy = false;

          if (message.type === 'error') {
            pending.reject(new Error(message.message ?? 'Embedding worker error'));
            return;
          }

          pending.resolve(message.embeddings ?? []);
        });

        worker.on('error', (error) => {
          startupError = error;
          reject(error);
        });

        worker.on('exit', (code) => {
          if (code !== 0 && !startupError) {
            reject(new Error(`Embedding worker exited with code ${code}`));
          }
        });
      }
    });

    return this.readyPromise;
  }

  private async runOnWorker(worker: Worker, texts: string[]): Promise<number[][]> {
    const id = `embed-${++this.requestCounter}`;
    return new Promise<number[][]>((resolve, reject) => {
      this.pendingByWorker.set(worker, { resolve, reject });
      worker.postMessage({ type: 'embed', id, texts });
    });
  }

  private async acquireWorker(): Promise<WorkerSlot> {
    await this.ensureWorkers();

    while (true) {
      const available = this.workers.find((slot) => !slot.busy);
      if (available) {
        available.busy = true;
        return available;
      }
      await yieldToEventLoop();
    }
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const slot = await this.acquireWorker();
    try {
      return await this.runOnWorker(slot.worker, texts);
    } finally {
      slot.busy = false;
    }
  }

  async embedChunks(
    chunks: CodeChunk[],
    shouldStop?: () => boolean,
    onProgress?: (progress: EmbeddingProgress) => void
  ): Promise<EmbeddingRecord[]> {
    console.time('Embedding Generation');
    const startMs = performance.now();
    logProcessMemory('embedding pool before embedChunks');
    await this.ensureWorkers();

    const records: EmbeddingRecord[] = [];
    const batches: CodeChunk[][] = [];

    for (let index = 0; index < chunks.length; index += BATCH_SIZE) {
      batches.push(chunks.slice(index, index + BATCH_SIZE));
    }

    let chunksProcessed = 0;
    const batchQueue = [...batches];

    const runWorker = async () => {
      while (batchQueue.length > 0) {
        if (shouldStop?.()) return;

        const batch = batchQueue.shift();
        if (!batch) return;

        const embeddings = await this.embedBatch(batch.map((chunk) => chunk.content));

        for (let index = 0; index < batch.length; index += 1) {
          const chunk = batch[index];
          records.push({
            filePath: chunk.filePath,
            content: chunk.content,
            embedding: embeddings[index],
            symbolName: chunk.symbolName,
            symbolType: chunk.symbolType,
          });
        }

        chunksProcessed += batch.length;
        onProgress?.({ chunksProcessed, chunksTotal: chunks.length });
        await yieldToEventLoop();
      }
    };

    await Promise.all(Array.from({ length: WORKER_COUNT }, () => runWorker()));
    console.timeEnd('Embedding Generation');
    logProcessMemory('embedding pool after embedChunks');
    console.log(
      `[perf] Embedding generation produced ${records.length} embeddings in ${(performance.now() - startMs).toFixed(3)}ms`
    );

    return records;
  }

  async embedQuery(text: string): Promise<number[]> {
    logProcessMemory('embedding pool before embedQuery');
    const [embedding] = await this.embedBatch([text]);
    logProcessMemory('embedding pool after embedQuery');
    return embedding;
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      this.workers.map(
        (slot) =>
          new Promise<void>((resolve) => {
            slot.worker.postMessage({ type: 'shutdown' });
            slot.worker.once('exit', () => resolve());
            setTimeout(resolve, 2000);
          })
      )
    );
    this.workers = [];
    this.readyPromise = null;
  }
}

export const embeddingPoolService = new EmbeddingPoolService();
