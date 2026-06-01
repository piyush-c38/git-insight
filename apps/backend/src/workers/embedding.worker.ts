import { parentPort } from 'worker_threads';
import { pipeline, env } from '@xenova/transformers';
import { logEmbeddingThroughput } from '../lib/embedding-perf';
import { logProcessMemory, RENDER_MEMORY_LIMIT_MB } from '../lib/memory';

env.allowLocalModels = false;

type EmbedRequest = {
  type: 'embed';
  id: string;
  texts: string[];
};

type WorkerMessage = EmbedRequest | { type: 'shutdown' };

type TensorLike = {
  data: ArrayLike<number>;
  dims?: number[];
  tolist?: () => number[][] | number[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let modelLoadPromise: Promise<void> | null = null;

function tensorToEmbeddings(result: TensorLike): number[][] {
  if (typeof result.tolist === 'function') {
    const list = result.tolist();
    if (Array.isArray(list) && list.length > 0 && Array.isArray(list[0])) {
      return list as number[][];
    }
    if (Array.isArray(list)) {
      return [list as number[]];
    }
  }

  const dims = result.dims ?? [1, result.data.length];
  const batchSize = dims.length >= 2 ? dims[0] : 1;
  const dim = dims.length >= 2 ? dims[dims.length - 1] : result.data.length;
  const data = Array.from(result.data);
  const embeddings: number[][] = [];

  for (let i = 0; i < batchSize; i += 1) {
    embeddings.push(data.slice(i * dim, (i + 1) * dim));
  }

  return embeddings;
}

async function ensureModel(): Promise<void> {
  if (extractor) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    logProcessMemory('embedding worker before model load');
    console.time('Embedding Model Initialization');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.timeEnd('Embedding Model Initialization');
    const after = logProcessMemory('embedding worker after model load');
    if (after.rssMb > RENDER_MEMORY_LIMIT_MB) {
      console.warn(
        `[memory] Process RSS ${after.rssMb}MB exceeds Render limit (${RENDER_MEMORY_LIMIT_MB}MB). Consider lowering EMBEDDING_BATCH_SIZE.`
      );
    }
  })();

  return modelLoadPromise;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  await ensureModel();
  if (!extractor) {
    throw new Error('Embedding model is not initialized');
  }

  const startMs = performance.now();

  // Batch inference: single forward pass for all texts in the worker message.
  const result = (await extractor(texts, { pooling: 'mean', normalize: true })) as TensorLike;
  const embeddings = tensorToEmbeddings(result);

  if (embeddings.length !== texts.length) {
    throw new Error(
      `Batch embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`
    );
  }

  const durationMs = performance.now() - startMs;
  logEmbeddingThroughput({
    label: 'worker batch',
    count: texts.length,
    durationMs,
    batchSize: texts.length,
  });

  return embeddings;
}

parentPort?.postMessage({ type: 'ready' });

parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'shutdown') {
    process.exit(0);
  }

  if (message.type !== 'embed') {
    return;
  }

  try {
    const embeddings = await embedTexts(message.texts);
    parentPort?.postMessage({ type: 'embed-result', id: message.id, embeddings });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Embedding worker failed';
    parentPort?.postMessage({ type: 'error', id: message.id, message: errMessage });
  }
});
