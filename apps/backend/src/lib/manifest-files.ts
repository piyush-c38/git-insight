import fs from 'fs';
import path from 'path';

const LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'poetry.lock',
  'Pipfile.lock',
]);

const MANIFEST_FILES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  'pubspec.yaml',
  'build.gradle',
  'build.gradle.kts',
] as const;

export type ManifestFileName = (typeof MANIFEST_FILES)[number];

export function isLockFile(fileName: string): boolean {
  return LOCK_FILES.has(fileName);
}

export function isAllowedManifestFile(fileName: string): boolean {
  return (MANIFEST_FILES as readonly string[]).includes(fileName);
}

export function findManifestFiles(repoRoot: string): { relativePath: string; fileName: ManifestFileName }[] {
  const found: { relativePath: string; fileName: ManifestFileName }[] = [];

  for (const fileName of MANIFEST_FILES) {
    const absolutePath = path.join(repoRoot, fileName);
    if (fs.existsSync(absolutePath)) {
      found.push({ relativePath: fileName, fileName });
    }
  }

  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = path.join(appsDir, entry.name, 'package.json');
      if (fs.existsSync(pkgPath)) {
        found.push({
          relativePath: `apps/${entry.name}/package.json`,
          fileName: 'package.json',
        });
      }
    }
  }

  return found;
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
