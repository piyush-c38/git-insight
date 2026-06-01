import { parentPort } from 'worker_threads';
import { pipeline, env } from '@xenova/transformers';
import { logEmbeddingThroughput } from '../lib/embedding-perf';
import { logWorkerBatchDiag } from '../lib/embedding-diag';
import { logProcessMemory, RENDER_MEMORY_LIMIT_MB } from '../lib/memory';

env.allowLocalModels = false;

type EmbedRequest = {
  type: 'embed';
  id: string;
  texts: string[];
  batchIndex?: number;
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
let workerBatchCounter = 0;

function formatDims(dims?: number[]): string {
  if (!dims || dims.length === 0) return 'unknown';
  return `[${dims.join(', ')}]`;
}

function tensorToEmbeddingsFromTolist(result: TensorLike): number[][] | null {
  if (typeof result.tolist !== 'function') return null;
  const list = result.tolist();
  if (Array.isArray(list) && list.length > 0 && Array.isArray(list[0])) {
    return list as number[][];
  }
  if (Array.isArray(list)) {
    return [list as number[]];
  }
  return null;
}

function tensorToEmbeddingsFromSlice(result: TensorLike): number[][] {
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

function tensorToEmbeddings(result: TensorLike): { embeddings: number[][]; path: 'tolist' | 'slice' | 'unknown' } {
  const fromTolist = tensorToEmbeddingsFromTolist(result);
  if (fromTolist) {
    return { embeddings: fromTolist, path: 'tolist' };
  }
  return { embeddings: tensorToEmbeddingsFromSlice(result), path: 'slice' };
}

async function ensureModel(): Promise<void> {
  if (extractor) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    logProcessMemory('embedding worker before model load');
    console.time('Embedding Model Initialization');
    const modelLoadStart = performance.now();
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const modelLoadMs = performance.now() - modelLoadStart;
    console.timeEnd('Embedding Model Initialization');
    console.log('[embed-diag] Model load time (first batch only):', `${modelLoadMs.toFixed(1)} ms`);
    const after = logProcessMemory('embedding worker after model load');
    if (after.rssMb > RENDER_MEMORY_LIMIT_MB) {
      console.warn(
        `[memory] Process RSS ${after.rssMb}MB exceeds Render limit (${RENDER_MEMORY_LIMIT_MB}MB). Consider lowering EMBEDDING_BATCH_SIZE.`
      );
    }
  })();

  return modelLoadPromise;
}

async function embedTexts(texts: string[], batchIndex: number): Promise<number[][]> {
  if (texts.length === 0) return [];

  const workerTotalStart = performance.now();

  console.log('[embed-diag] Batch input count:', texts.length);
  console.log('[embed-diag] Input is array:', Array.isArray(texts));
  console.log(
    '[embed-diag] Model invocation:',
    texts.length === 1 ? 'extractor(text) — single string' : 'extractor(texts) — string array'
  );

  const ensureStart = performance.now();
  await ensureModel();
  const ensureMs = performance.now() - ensureStart;
  if (ensureMs > 1) {
    console.log('[embed-diag] ensureModel() time (excl. first load):', `${ensureMs.toFixed(1)} ms`);
  }

  if (!extractor) {
    throw new Error('Embedding model is not initialized');
  }

  const modelInput = texts.length === 1 ? texts[0] : texts;
  const invocationLabel: 'extractor(texts)' | 'extractor(text)' =
    texts.length === 1 ? 'extractor(text)' : 'extractor(texts)';

  const inferStart = performance.now();
  const result = (await extractor(modelInput, { pooling: 'mean', normalize: true })) as TensorLike;
  const modelInferenceMs = performance.now() - inferStart;

  const outputDims = formatDims(result.dims);
  console.log('[embed-diag] Output tensor shape (dims):', outputDims);

  let tensorTolistMs = 0;
  if (typeof result.tolist === 'function') {
    const tolistStart = performance.now();
    result.tolist();
    tensorTolistMs = performance.now() - tolistStart;
  }

  const sliceStart = performance.now();
  const sliceProbe = tensorToEmbeddingsFromSlice(result);
  const tensorSliceMs = performance.now() - sliceStart;
  void sliceProbe;

  const convertStart = performance.now();
  const { embeddings, path: conversionPath } = tensorToEmbeddings(result);
  const tensorConversionMs = performance.now() - convertStart;

  const validationStart = performance.now();
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Batch embedding count mismatch: expected ${texts.length}, got ${embeddings.length} (dims=${outputDims})`
    );
  }
  const validationMs = performance.now() - validationStart;

  const workerTotalMs = performance.now() - workerTotalStart;

  logWorkerBatchDiag({
    batchIndex,
    inputCount: texts.length,
    modelInvocation: invocationLabel,
    outputDims,
    modelInferenceMs,
    tensorConversionMs,
    tensorTolistMs,
    tensorSliceMs,
    validationMs,
    workerTotalMs,
    conversionPath,
  });

  logEmbeddingThroughput({
    label: 'worker batch',
    count: texts.length,
    durationMs: workerTotalMs,
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

  const batchIndex = message.batchIndex ?? ++workerBatchCounter;

  try {
    const embeddings = await embedTexts(message.texts, batchIndex);
    parentPort?.postMessage({ type: 'embed-result', id: message.id, embeddings });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Embedding worker failed';
    parentPort?.postMessage({ type: 'error', id: message.id, message: errMessage });
  }
});
