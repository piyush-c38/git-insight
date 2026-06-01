import fs from 'fs';

export type RepoSizeStats = {
  fileCount: number;
  totalBytes: number;
  totalMegabytes: number;
};

export function computeRepoSizeStats(files: string[]): RepoSizeStats {
  let totalBytes = 0;
  for (const filePath of files) {
    try {
      totalBytes += fs.statSync(filePath).size;
    } catch {
      // Skip files that disappear between scan and stat.
    }
  }

  return {
    fileCount: files.length,
    totalBytes,
    totalMegabytes: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  };
}

/** Logs duration in the same style as console.timeEnd (for stages invoked in loops). */
export function logStageDuration(label: string, durationMs: number): void {
  console.log(`${label}: ${durationMs.toFixed(3)}ms`);
}

export function logAnalysisSummary(stats: {
  filesProcessed: number;
  chunksGenerated: number;
  embeddingsGenerated: number;
  vectorsInserted: number;
  repoSize: RepoSizeStats;
  totalExecutionMs: number;
  treeSitterParsingMs?: number;
  treeSitterFiles?: number;
  babelParsingMs?: number;
  babelFiles?: number;
}): void {
  console.log('[perf] --- Repository analysis summary ---');
  console.log(`[perf] Files processed: ${stats.filesProcessed}`);
  console.log(`[perf] Chunks generated: ${stats.chunksGenerated}`);
  console.log(`[perf] Embeddings generated: ${stats.embeddingsGenerated}`);
  console.log(`[perf] Vectors inserted into Chroma: ${stats.vectorsInserted}`);
  console.log(
    `[perf] Repository size: ${stats.repoSize.fileCount} files, ${stats.repoSize.totalBytes} bytes (${stats.repoSize.totalMegabytes} MB)`
  );
  if (stats.treeSitterParsingMs !== undefined) {
    console.log(
      `[perf] Tree-sitter files: ${stats.treeSitterFiles ?? 0}, accumulated: ${stats.treeSitterParsingMs.toFixed(3)}ms`
    );
  }
  if (stats.babelParsingMs !== undefined) {
    console.log(
      `[perf] Babel/TypeScript files: ${stats.babelFiles ?? 0}, accumulated: ${stats.babelParsingMs.toFixed(3)}ms`
    );
  }
  console.log(`[perf] Total execution time: ${stats.totalExecutionMs.toFixed(3)}ms`);
  console.log('[perf] -----------------------------------');
}
