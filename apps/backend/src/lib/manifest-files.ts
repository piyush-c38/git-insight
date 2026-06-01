import fs from 'fs';
import path from 'path';
import { shouldSkipDirectory } from './embeddable-files';

const LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'poetry.lock',
  'Pipfile.lock',
]);

const EXACT_MANIFEST_NAMES = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'pom.xml',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  'pubspec.yaml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
]);

export type ManifestFileName = string;

export type ManifestEntry = {
  relativePath: string;
  fileName: ManifestFileName;
};

export function isLockFile(fileName: string): boolean {
  return LOCK_FILES.has(fileName);
}

export function isManifestFileName(fileName: string): boolean {
  if (isLockFile(fileName)) return false;
  if (EXACT_MANIFEST_NAMES.has(fileName)) return true;
  return fileName.endsWith('.csproj');
}

export function isAllowedManifestFile(fileName: string): boolean {
  return isManifestFileName(fileName);
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\//, '');
}

function manifestEntryFromRelativePath(relativePath: string): ManifestEntry {
  const normalized = normalizeRelativePath(relativePath);
  return {
    relativePath: normalized,
    fileName: path.basename(normalized),
  };
}

function discoverManifestsFromFileIndex(relativeFiles: string[]): ManifestEntry[] {
  const seen = new Set<string>();
  const found: ManifestEntry[] = [];

  for (const filePath of relativeFiles) {
    const normalized = normalizeRelativePath(filePath);
    const fileName = path.basename(normalized);
    if (!isManifestFileName(fileName)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    found.push(manifestEntryFromRelativePath(normalized));
  }

  return found;
}

function walkManifests(repoRoot: string, dir: string, found: ManifestEntry[], seen: Set<string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      walkManifests(repoRoot, absolutePath, found, seen);
      continue;
    }

    if (!isManifestFileName(entry.name)) continue;

    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));
    if (seen.has(relativePath)) continue;
    seen.add(relativePath);
    found.push(manifestEntryFromRelativePath(relativePath));
  }
}

function discoverManifestsByWalk(repoRoot: string): ManifestEntry[] {
  const seen = new Set<string>();
  const found: ManifestEntry[] = [];
  walkManifests(repoRoot, repoRoot, found, seen);
  return found;
}

/**
 * Find all dependency manifest files in a repository.
 * Uses the scanned file index first, then falls back to a directory walk.
 */
export function findManifestFiles(repoRoot: string, relativeFiles?: string[]): ManifestEntry[] {
  const seen = new Set<string>();
  const merged: ManifestEntry[] = [];

  const addEntries = (entries: ManifestEntry[]) => {
    for (const entry of entries) {
      if (seen.has(entry.relativePath)) continue;
      seen.add(entry.relativePath);
      merged.push(entry);
    }
  };

  if (relativeFiles?.length) {
    addEntries(discoverManifestsFromFileIndex(relativeFiles));
  }

  addEntries(discoverManifestsByWalk(repoRoot));

  merged.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return merged;
}

export function readManifestContent(repoRoot: string, relativePath: string): string | undefined {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  try {
    return fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return undefined;
  }
}

export function packageKeyFromManifestPath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === 'package.json') return 'root';
  const dir = path.dirname(normalized);
  if (!dir || dir === '.') return 'root';
  const segments = dir.split('/').filter(Boolean);
  if (segments[0] === 'apps' && segments.length >= 2) return segments[1];
  if (segments[0] === 'packages' && segments.length >= 2) return segments[1];
  return segments[segments.length - 1] ?? 'root';
}
