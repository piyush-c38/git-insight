import { parentPort } from 'worker_threads';
import { pipeline, env } from '@xenova/transformers';
import { logProcessMemory, RENDER_MEMORY_LIMIT_MB } from '../lib/memory';

env.allowLocalModels = false;

type EmbedRequest = {
  type: 'embed';
  id: string;
  texts: string[];
};

type WorkerMessage = EmbedRequest | { type: 'shutdown' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let modelLoadPromise: Promise<void> | null = null;

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
  await ensureModel();
  if (!extractor) {
    throw new Error('Embedding model is not initialized');
  }

  const embeddings: number[][] = [];
  for (const text of texts) {
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    embeddings.push(Array.from(result.data));
  }
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
