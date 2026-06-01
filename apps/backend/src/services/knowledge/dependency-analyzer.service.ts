import path from 'path';
import { findManifestFiles, readManifestContent } from '../../lib/manifest-files';
import { classifyPackage, groupByCategory } from '../../lib/dependency-classifier';
import { ClassifiedDependency, DependencySummary } from '../../types/knowledge';

type ExtractedDep = { name: string; version: string };

function parsePackageJson(content: string, source: string): ExtractedDep[] {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
    const deps: ExtractedDep[] = [];

    for (const section of sections) {
      const value = parsed[section];
      if (!value || typeof value !== 'object') continue;
      for (const [name, version] of Object.entries(value as Record<string, string>)) {
        deps.push({ name, version: String(version) });
      }
    }
    return deps;
  } catch {
    return [];
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
      return { name: match[1], version: (match[2] || '').trim() || '*' };
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
      if (parts[0]) deps.push({ name: parts[0], version: parts[1] ?? '' });
      continue;
    }
    if (inRequire) {
      const parts = trimmed.split(/\s+/);
      if (parts[0]) deps.push({ name: parts[0], version: parts[1] ?? '' });
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
      deps.push({ name: match[1], version: match[2].replace(/"/g, '') });
    }
  }
  return deps;
}

function extractFromManifest(relativePath: string, content: string): ExtractedDep[] {
  const fileName = path.basename(relativePath);
  if (fileName === 'package.json') return parsePackageJson(content, relativePath);
  if (fileName === 'requirements.txt') return parseRequirementsTxt(content);
  if (fileName === 'go.mod') return parseGoMod(content);
  if (fileName === 'Cargo.toml') return parseCargoToml(content);
  return [];
}

class DependencyAnalyzerService {
  analyze(repoRoot: string): DependencySummary {
    const manifests = findManifestFiles(repoRoot);
    const seen = new Set<string>();
    const classified: ClassifiedDependency[] = [];

    for (const manifest of manifests) {
      const content = readManifestContent(repoRoot, manifest.relativePath);
      if (!content) continue;

      const extracted = extractFromManifest(manifest.relativePath, content);
      for (const dep of extracted) {
        const key = `${dep.name}@${manifest.relativePath}`;
        if (seen.has(key)) continue;
        seen.add(key);
        classified.push(classifyPackage(dep.name, dep.version, manifest.relativePath));
      }
    }

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
      highlights,
      summary,
    };
  }
}

export const dependencyAnalyzerService = new DependencyAnalyzerService();
