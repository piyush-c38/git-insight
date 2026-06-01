import fs from 'fs';
import path from 'path';
import { ArchitectureKnowledge } from '../../types/knowledge';
import { RepositorySummaryKnowledge } from '../../types/knowledge';
import { findEntryPoints, getTopLevelFolders } from '../../lib/repo-structure';

function readReadmeExcerpt(repoRoot: string, maxChars = 800): string {
  const candidates = ['README.md', 'readme.md'];
  for (const name of candidates) {
    const filePath = path.join(repoRoot, name);
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const withoutBadges = raw.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim();
      return withoutBadges.slice(0, maxChars);
    } catch {
      return '';
    }
  }
  return '';
}

class RepositorySummaryService {
  generate(
    repoRoot: string,
    relativeFiles: string[],
    architecture: ArchitectureKnowledge,
    packageJson?: Record<string, unknown>
  ): RepositorySummaryKnowledge {
    const readme = readReadmeExcerpt(repoRoot);
    const packageDescription =
      typeof packageJson?.description === 'string' ? packageJson.description : undefined;
    const packageName = typeof packageJson?.name === 'string' ? packageJson.name : undefined;

    let purpose = packageDescription ?? '';
    if (!purpose && readme) {
      const firstParagraph = readme
        .split('\n\n')
        .map((p) => p.replace(/^#+\s+/, '').trim())
        .find((p) => p.length > 20);
      purpose = firstParagraph ?? 'Repository purpose inferred from structure.';
    }
    if (!purpose) {
      purpose = `${packageName ?? 'This repository'} provides application code organized into modular directories.`;
    }

    const topFolders = getTopLevelFolders(relativeFiles);
    const mainModules = Array.from(topFolders.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name,
        path: `${name}/`,
        description: `${count} files — ${inferModuleDescription(name, relativeFiles)}`,
      }));

    const coreFeatures: string[] = [];
    if (architecture.frontend.framework) {
      coreFeatures.push(`${architecture.frontend.framework} user interface`);
    }
    if (architecture.backend.framework) {
      coreFeatures.push(`${architecture.backend.framework} HTTP API layer`);
    }
    if (architecture.backend.routes.length) {
      coreFeatures.push(`${architecture.backend.routes.length} route modules`);
    }
    if (architecture.database.orm) {
      coreFeatures.push(`Data persistence via ${architecture.database.orm}`);
    }
    if (architecture.authentication.strategy) {
      coreFeatures.push(`Authentication: ${architecture.authentication.strategy}`);
    }
    if (architecture.externalServices.length) {
      coreFeatures.push(
        `External integrations: ${architecture.externalServices.map((e) => e.name).join(', ')}`
      );
    }

    const keyWorkflows = [...architecture.dataFlow];
    if (architecture.backend.controllers.length) {
      keyWorkflows.push('Request → route → controller → service → data store');
    }

    const entryPoints = findEntryPoints(relativeFiles).map((ep) => ({
      path: ep,
      role: ep.includes('pages/') ? 'Frontend page entry' : ep.includes('backend') ? 'Backend entry' : 'Application entry',
    }));

    return {
      generatedAt: new Date().toISOString(),
      purpose,
      mainModules,
      coreFeatures: coreFeatures.length ? coreFeatures : ['Application logic organized by directory conventions'],
      keyWorkflows: keyWorkflows.length ? keyWorkflows : ['Inspect entry points and API routes to trace behavior'],
      entryPoints,
      summary: `${packageName ?? 'Repository'}: ${purpose.slice(0, 200)}${purpose.length > 200 ? '…' : ''}`,
    };
  }
}

function inferModuleDescription(folder: string, relativeFiles: string[]): string {
  const lower = folder.toLowerCase();
  if (/frontend|client|web|ui/.test(lower)) return 'client/UI code';
  if (/backend|server|api/.test(lower)) return 'server/API code';
  if (/test|spec/.test(lower)) return 'tests';
  if (/docs?/.test(lower)) return 'documentation';
  if (/packages?/.test(lower)) return 'shared packages';
  const hasApi = relativeFiles.some((f) => f.startsWith(`${folder}/`) && /\/api\//.test(f));
  if (hasApi) return 'includes API routes';
  return 'source files';
}

export const repositorySummaryService = new RepositorySummaryService();
