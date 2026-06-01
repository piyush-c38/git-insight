import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { yieldToEventLoop } from '../lib/async-utils';
import { logPoolBatchDiag } from '../lib/embedding-diag';
import { logEmbeddingThroughput } from '../lib/embedding-perf';
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
/** Texts per worker message (each triggers one batched ONNX forward pass). */
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
      console.log('[embed-diag] Worker script path:', scriptPath);
      console.log('[embed-diag] EMBEDDING_BATCH_SIZE env:', process.env.EMBEDDING_BATCH_SIZE ?? '(unset, using default)');
      console.log('[embed-diag] Resolved pool BATCH_SIZE:', BATCH_SIZE);
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

  private async runOnWorker(worker: Worker, texts: string[], batchIndex: number): Promise<number[][]> {
    const id = `embed-${++this.requestCounter}`;
    return new Promise<number[][]>((resolve, reject) => {
      this.pendingByWorker.set(worker, { resolve, reject });
      worker.postMessage({ type: 'embed', id, texts, batchIndex });
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

  private async embedBatch(texts: string[], batchIndex: number): Promise<number[][]> {
    const slot = await this.acquireWorker();
    try {
      return await this.runOnWorker(slot.worker, texts, batchIndex);
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

    console.log(
      `[perf] Embedding pipeline: ${chunks.length} chunks, ${batches.length} worker batch(es), batch size ${BATCH_SIZE}, ${WORKER_COUNT} worker(s)`
    );

    let chunksProcessed = 0;
    const batchQueue = [...batches];
    let poolBatchIndex = 0;
    const poolBatchTimings: Array<{ batchIndex: number; roundTripMs: number; texts: number }> = [];

    const runWorker = async () => {
      while (batchQueue.length > 0) {
        if (shouldStop?.()) return;

        const batch = batchQueue.shift();
        if (!batch) return;

        const batchIndex = poolBatchIndex;
        poolBatchIndex += 1;
        const texts = batch.map((chunk) => chunk.content);

        const roundTripStart = performance.now();
        const embeddings = await this.embedBatch(texts, batchIndex);
        const workerRoundTripMs = performance.now() - roundTripStart;

        const assemblyStart = performance.now();
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
        const recordAssemblyMs = performance.now() - assemblyStart;

        logPoolBatchDiag({
          batchIndex,
          textsSent: texts.length,
          workerRoundTripMs,
          recordAssemblyMs,
          configuredBatchSize: BATCH_SIZE,
        });

        poolBatchTimings.push({ batchIndex, roundTripMs: workerRoundTripMs, texts: texts.length });

        chunksProcessed += batch.length;
        onProgress?.({ chunksProcessed, chunksTotal: chunks.length });
        await yieldToEventLoop();
      }
    };

    await Promise.all(Array.from({ length: WORKER_COUNT }, () => runWorker()));

    const totalMs = performance.now() - startMs;
    console.timeEnd('Embedding Generation');
    logProcessMemory('embedding pool after embedChunks');
    console.log(
      `[perf] Embedding generation produced ${records.length} embeddings in ${totalMs.toFixed(3)}ms`
    );
    logEmbeddingThroughput({
      label: 'total',
      count: records.length,
      durationMs: totalMs,
      batchSize: BATCH_SIZE,
    });

    if (poolBatchTimings.length > 0) {
      const sumRoundTrip = poolBatchTimings.reduce((acc, row) => acc + row.roundTripMs, 0);
      const maxRoundTrip = Math.max(...poolBatchTimings.map((row) => row.roundTripMs));
      const firstBatch = poolBatchTimings[0];
      console.log('[embed-diag] ── pool summary ──');
      console.log('[embed-diag] Total pool batches:', poolBatchTimings.length);
      console.log('[embed-diag] Sum of worker round-trips:', `${sumRoundTrip.toFixed(1)} ms`);
      console.log('[embed-diag] Max single batch round-trip:', `${maxRoundTrip.toFixed(1)} ms`);
      console.log('[embed-diag] First batch round-trip (often includes model load):', `${firstBatch.roundTripMs.toFixed(1)} ms`);
      console.log(
        '[embed-diag] Overhead outside round-trips (total - sum round-trips):',
        `${Math.max(0, totalMs - sumRoundTrip).toFixed(1)} ms`
      );
      console.log(
        '[embed-diag] Compare worker [Model inference time] vs pool [Worker round-trip] per batch to locate bottleneck'
      );
    }

    return records;
  }

  async embedQuery(text: string): Promise<number[]> {
    logProcessMemory('embedding pool before embedQuery');
    const [embedding] = await this.embedBatch([text], 0);
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
