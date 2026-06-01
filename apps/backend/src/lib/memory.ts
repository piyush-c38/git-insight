/** Render free/starter instances are capped at 512MB RSS. */
export const RENDER_MEMORY_LIMIT_MB = Number(process.env.RENDER_MEMORY_LIMIT_MB) || 512;

export type MemorySnapshot = {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  arrayBuffersMb: number;
};

export function getMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  const toMb = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(1));
  return {
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    externalMb: toMb(usage.external),
    arrayBuffersMb: toMb(usage.arrayBuffers ?? 0),
  };
}

export function logProcessMemory(label: string): MemorySnapshot {
  const snapshot = getMemorySnapshot();
  const overLimit = snapshot.rssMb > RENDER_MEMORY_LIMIT_MB;
  console.log(
    `[memory] ${label}`,
    snapshot,
    overLimit ? `(WARN: RSS exceeds ${RENDER_MEMORY_LIMIT_MB}MB Render limit)` : ''
  );
  return snapshot;
}
