import path from 'path';
import { DependencySummary } from '../../types/knowledge';
import { TechStackKnowledge, TechStackLayer } from '../../types/knowledge';
import { getTopLevelFolders, normalizeRelativePath } from '../../lib/repo-structure';

function layer(name: string, technologies: string[], evidence: string[]): TechStackLayer {
  return { name, technologies, evidence };
}

class TechStackService {
  analyze(
    relativeFiles: string[],
    dependencySummary: DependencySummary,
    repoLanguages: string[] = []
  ): TechStackKnowledge {
    const extCounts = new Map<string, number>();
    for (const filePath of relativeFiles) {
      const ext = path.extname(filePath).toLowerCase();
      if (!ext) continue;
      extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
    }

    const languages: string[] = [];
    if (extCounts.get('.ts') || extCounts.get('.tsx')) languages.push('TypeScript');
    if (extCounts.get('.js') || extCounts.get('.jsx')) languages.push('JavaScript');
    if (extCounts.get('.py')) languages.push('Python');
    if (extCounts.get('.go')) languages.push('Go');
    if (extCounts.get('.rs')) languages.push('Rust');
    if (extCounts.get('.java')) languages.push('Java');
    for (const lang of repoLanguages) {
      if (!languages.includes(lang)) languages.push(lang);
    }

    const allDeps = Object.values(dependencySummary.byCategory).flat();
    const depNames = new Set(allDeps.map((d) => d.name));

    const frontendTech: string[] = [];
    const backendTech: string[] = [];
    const databaseTech: string[] = [];
    const runtimeTech: string[] = [];
    const toolingTech: string[] = [];

    const ui = dependencySummary.byCategory.UI.map((d) => d.name);
    const backend = dependencySummary.byCategory.Backend.map((d) => d.name);
    const db = dependencySummary.byCategory.Database.map((d) => d.name);
    const build = dependencySummary.byCategory['Build Tools'].map((d) => d.name);
    const test = dependencySummary.byCategory.Testing.map((d) => d.name);

    if (depNames.has('next')) frontendTech.push('Next.js');
    if (depNames.has('react')) frontendTech.push('React');
    if (depNames.has('vue')) frontendTech.push('Vue');
    if (depNames.has('express')) backendTech.push('Express');
    if (depNames.has('@nestjs/core')) backendTech.push('NestJS');
    if (depNames.has('fastify')) backendTech.push('Fastify');
    if (depNames.has('prisma') || depNames.has('@prisma/client')) databaseTech.push('Prisma');
    if (depNames.has('typeorm')) databaseTech.push('TypeORM');
    if (depNames.has('mongoose')) databaseTech.push('Mongoose');

    frontendTech.push(...ui.filter((n) => !frontendTech.includes(n)).slice(0, 8));
    backendTech.push(...backend.filter((n) => !backendTech.includes(n)).slice(0, 8));
    databaseTech.push(...db.filter((n) => !databaseTech.includes(n)).slice(0, 6));
    toolingTech.push(...build.slice(0, 6), ...test.slice(0, 4));

    if (relativeFiles.some((f) => normalizeRelativePath(f).includes('apps/backend'))) {
      runtimeTech.push('Node.js (monorepo backend app)');
    }
    if (relativeFiles.some((f) => normalizeRelativePath(f).includes('apps/frontend'))) {
      runtimeTech.push('Node.js (monorepo frontend app)');
    }
    if (languages.includes('Python')) runtimeTech.push('Python runtime');
    if (languages.includes('Go')) runtimeTech.push('Go runtime');

    const topFolders = Array.from(getTopLevelFolders(relativeFiles).keys()).slice(0, 8);
    const primaryLanguage = languages[0] ?? (repoLanguages[0] ?? 'Unknown');

    const tooling: TechStackLayer[] = [];
    if (toolingTech.length > 0) {
      tooling.push(layer('Build & Test', [...new Set(toolingTech)], topFolders));
    }

    const summaryParts = [
      `Primary language: ${primaryLanguage}.`,
      frontendTech.length ? `Frontend: ${frontendTech.slice(0, 4).join(', ')}.` : null,
      backendTech.length ? `Backend: ${backendTech.slice(0, 4).join(', ')}.` : null,
      databaseTech.length ? `Data: ${databaseTech.slice(0, 3).join(', ')}.` : null,
    ].filter(Boolean);

    return {
      generatedAt: new Date().toISOString(),
      primaryLanguage,
      languages,
      frontend:
        frontendTech.length > 0
          ? layer('Frontend', [...new Set(frontendTech)], topFolders.filter((f) => /frontend|client|web|ui/i.test(f)))
          : null,
      backend:
        backendTech.length > 0
          ? layer('Backend', [...new Set(backendTech)], topFolders.filter((f) => /backend|server|api/i.test(f)))
          : null,
      database:
        databaseTech.length > 0 ? layer('Database', [...new Set(databaseTech)], ['manifest dependencies']) : null,
      runtime: runtimeTech.length > 0 ? layer('Runtime', [...new Set(runtimeTech)], topFolders) : null,
      tooling,
      summary: summaryParts.join(' ') || 'Tech stack inferred from repository structure and manifest files.',
    };
  }
}

export const techStackService = new TechStackService();
