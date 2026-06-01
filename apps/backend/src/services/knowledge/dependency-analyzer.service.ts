import path from 'path';
import {
  findManifestFiles,
  packageKeyFromManifestPath,
  readManifestContent,
} from '../../lib/manifest-files';
import { classifyPackage, groupByCategory } from '../../lib/dependency-classifier';
import {
  ClassifiedDependency,
  DependencySummary,
  PackageDependencyGroup,
} from '../../types/knowledge';

type ExtractedDep = { name: string; version: string; section: string };

function normalizeManifestKey(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/\/package\.json$/, '').replace(/\//g, '_') || 'root';
}

type PackageJsonCounts = {
  dependencies: number;
  devDependencies: number;
  peerDependencies: number;
  optionalDependencies: number;
};

function parsePackageJson(content: string, manifestPath: string): { deps: ExtractedDep[]; counts: PackageJsonCounts } {
  const counts: PackageJsonCounts = {
    dependencies: 0,
    devDependencies: 0,
    peerDependencies: 0,
    optionalDependencies: 0,
  };
  const deps: ExtractedDep[] = [];

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

    for (const section of sections) {
      const value = parsed[section];
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

      const entries = Object.entries(value as Record<string, unknown>);
      counts[section] = entries.length;

      for (const [name, version] of entries) {
        deps.push({
          name,
          version: String(version ?? ''),
          section,
        });
      }
    }

    console.log('[dependency] package.json found:', manifestPath);
    console.log('[dependency] dependencies count:', counts.dependencies);
    console.log('[dependency] devDependencies count:', counts.devDependencies);
    console.log(
      '[dependency] total dependencies extracted:',
      counts.dependencies + counts.devDependencies + counts.peerDependencies + counts.optionalDependencies
    );

    return { deps, counts };
  } catch (error) {
    console.warn(`[dependency] Failed to parse package.json at ${manifestPath}:`, error);
    return { deps, counts };
  }
}

function parseRequirementsTxt(content: string): ExtractedDep[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const match = line.match(/^([a-zA-Z0-9_-]+)(.*)$/);
      if (!match) return null;
      return { name: match[1], version: (match[2] || '').trim() || '*', section: 'dependencies' };
    })
    .filter((dep): dep is ExtractedDep => Boolean(dep));
}

function parseGoMod(content: string): ExtractedDep[] {
  const deps: ExtractedDep[] = [];
  let inRequire = false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('require (')) {
      inRequire = true;
      continue;
    }
    if (inRequire && trimmed === ')') {
      inRequire = false;
      continue;
    }
    if (trimmed.startsWith('require ')) {
      const parts = trimmed.replace(/^require\s+/, '').split(/\s+/);
      if (parts[0]) deps.push({ name: parts[0], version: parts[1] ?? '', section: 'dependencies' });
      continue;
    }
    if (inRequire) {
      const parts = trimmed.split(/\s+/);
      if (parts[0]) deps.push({ name: parts[0], version: parts[1] ?? '', section: 'dependencies' });
    }
  }
  return deps;
}

function parseCargoToml(content: string): ExtractedDep[] {
  const deps: ExtractedDep[] = [];
  let inDeps = false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '[dependencies]') {
      inDeps = true;
      continue;
    }
    if (trimmed.startsWith('[') && trimmed !== '[dependencies]') {
      inDeps = false;
      continue;
    }
    if (!inDeps || !trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (match) {
      deps.push({ name: match[1], version: match[2].replace(/"/g, ''), section: 'dependencies' });
    }
  }
  return deps;
}

function extractFromManifest(relativePath: string, content: string): ExtractedDep[] {
  const fileName = path.basename(relativePath);
  if (fileName === 'package.json') {
    return parsePackageJson(content, relativePath).deps;
  }
  if (fileName === 'requirements.txt' || fileName === 'Pipfile') {
    const deps = parseRequirementsTxt(content);
    console.log('[dependency] manifest found:', relativePath);
    console.log('[dependency] total dependencies extracted:', deps.length);
    return deps;
  }
  if (fileName === 'go.mod') return parseGoMod(content);
  if (fileName === 'Cargo.toml') return parseCargoToml(content);
  console.log('[dependency] manifest found:', relativePath);
  return [];
}

function readPackageName(repoRoot: string, manifestPath: string): string | undefined {
  if (path.basename(manifestPath) !== 'package.json') return undefined;
  const content = readManifestContent(repoRoot, manifestPath);
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as { name?: string };
    return typeof parsed.name === 'string' ? parsed.name : undefined;
  } catch {
    return undefined;
  }
}

class DependencyAnalyzerService {
  analyze(repoRoot: string, relativeFiles?: string[]): DependencySummary {
    const manifests = findManifestFiles(repoRoot, relativeFiles);
    console.log(`[dependency] manifests discovered: ${manifests.length}`);

    const seen = new Set<string>();
    const classified: ClassifiedDependency[] = [];
    const byPackage: Record<string, PackageDependencyGroup> = {};

    for (const manifest of manifests) {
      const content = readManifestContent(repoRoot, manifest.relativePath);
      if (!content) continue;

      const extracted = extractFromManifest(manifest.relativePath, content);
      let packageKey = packageKeyFromManifestPath(manifest.relativePath);
      if (byPackage[packageKey] && byPackage[packageKey].manifestPath !== manifest.relativePath) {
        packageKey = normalizeManifestKey(manifest.relativePath);
      }
      const packageName = readPackageName(repoRoot, manifest.relativePath);

      if (!byPackage[packageKey]) {
        byPackage[packageKey] = {
          manifestPath: manifest.relativePath,
          packageName,
          dependenciesCount: 0,
          devDependenciesCount: 0,
          dependencies: [],
        };
      }

      for (const dep of extracted) {
        const source = `${manifest.relativePath}#${dep.section}`;
        const key = `${dep.name}@${source}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const classifiedDep = classifyPackage(dep.name, dep.version, source);
        classified.push(classifiedDep);
        byPackage[packageKey].dependencies.push(classifiedDep);

        if (dep.section === 'dependencies') {
          byPackage[packageKey].dependenciesCount += 1;
        } else if (dep.section === 'devDependencies') {
          byPackage[packageKey].devDependenciesCount += 1;
        }
      }

      if (path.basename(manifest.relativePath) === 'package.json') {
        byPackage[packageKey].manifestPath = manifest.relativePath;
        if (packageName) byPackage[packageKey].packageName = packageName;
      }
    }

    console.log('[dependency] total dependencies extracted:', classified.length);

    const byCategory = groupByCategory(classified);
    const highlights: string[] = [];

    for (const category of ['Frontend', 'UI', 'Backend', 'Database', 'Authentication', 'AI/ML'] as const) {
      const items = byCategory[category];
      if (items.length > 0) {
        highlights.push(`${category}: ${items.slice(0, 5).map((d) => d.name).join(', ')}`);
      }
    }

    const summary =
      classified.length === 0
        ? 'No declarative manifest dependencies were found (lock files are intentionally excluded).'
        : `Found ${classified.length} dependencies across ${manifests.length} manifest file(s). Primary categories: ${highlights.slice(0, 4).join('; ')}.`;

    return {
      generatedAt: new Date().toISOString(),
      manifestFiles: manifests.map((m) => m.relativePath),
      totalDependencies: classified.length,
      byCategory,
      byPackage,
      highlights,
      summary,
    };
  }
}

export const dependencyAnalyzerService = new DependencyAnalyzerService();
