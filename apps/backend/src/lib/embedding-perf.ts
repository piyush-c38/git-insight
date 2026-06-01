export function logEmbeddingThroughput(options: {
  label: string;
  count: number;
  durationMs: number;
  batchSize?: number;
}): void {
  const { label, count, durationMs, batchSize } = options;
  if (count <= 0 || durationMs <= 0) return;

  const embeddingsPerSecond = count / (durationMs / 1000);
  const averageLatencyMs = durationMs / count;

  if (batchSize !== undefined) {
    console.log(`[perf] Embedding batch size: ${batchSize}`);
  }
  console.log(`[perf] ${label} embeddings per second: ${embeddingsPerSecond.toFixed(2)}`);
  console.log(`[perf] ${label} average embedding latency: ${averageLatencyMs.toFixed(1)} ms`);
}
