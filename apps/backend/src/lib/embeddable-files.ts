import fs from 'fs';
import path from 'path';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.turbo',
  '.cache',
  'out',
  'vendor',
]);

const EMBEDDABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.md']);

const MAX_EMBED_FILE_BYTES = 512 * 1024;

export function shouldSkipDirectory(dirName: string): boolean {
  return SKIP_DIR_NAMES.has(dirName);
}

export function isEmbeddableFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  if (!EMBEDDABLE_EXTENSIONS.has(extension)) {
    return false;
  }

  const baseName = path.basename(filePath).toLowerCase();
  if (extension === '.md' && !/^readme(\.|$)/i.test(baseName)) {
    return false;
  }

  if (/\.(min|bundle|map)\./i.test(baseName) || baseName.endsWith('.min.js')) {
    return false;
  }

  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (
    normalized.includes('/dist/') ||
    normalized.includes('/build/') ||
    normalized.includes('/.next/') ||
    normalized.includes('/coverage/')
  ) {
    return false;
  }

  return true;
}

export function isEmbeddableFileWithinSize(filePath: string, sizeBytes: number): boolean {
  return isEmbeddableFile(filePath) && sizeBytes <= MAX_EMBED_FILE_BYTES;
}

export function filterEmbeddablePaths(filePaths: string[]): string[] {
  return filePaths.filter((filePath) => {
    if (!isEmbeddableFile(filePath)) return false;
    try {
      const size = fs.statSync(filePath).size;
      return isEmbeddableFileWithinSize(filePath, size);
    } catch {
      return false;
    }
  });
}
