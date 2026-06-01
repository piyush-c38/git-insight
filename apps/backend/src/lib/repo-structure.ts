import path from 'path';

export type ParsedFileRecord = {
  filePath: string;
  dependencies: string[];
  exports: string[];
};

const SKIP_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  'vendor',
  '.turbo',
]);

export function toRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

export function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function getTopLevelFolders(relativeFiles: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const filePath of relativeFiles) {
    const parts = normalizeRelativePath(filePath).split('/').filter(Boolean);
    if (parts.length === 0) continue;
    const top = parts[0];
    if (SKIP_SEGMENTS.has(top)) continue;
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return counts;
}

export function matchPaths(relativeFiles: string[], patterns: RegExp[]): string[] {
  return relativeFiles.filter((filePath) => patterns.some((pattern) => pattern.test(filePath)));
}

export function basenameNoExt(filePath: string): string {
  const base = path.basename(filePath);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function inferRoleFromPath(filePath: string): string | null {
  const normalized = normalizeRelativePath(filePath).toLowerCase();
  if (/(^|\/)(routes?|router)(\/|\.)/.test(normalized) || /route(s)?\.(ts|js|tsx|jsx|py)$/.test(normalized)) {
    return 'route';
  }
  if (/controller(s)?\.(ts|js|tsx|jsx|py)$/.test(normalized) || /(^|\/)controllers?\//.test(normalized)) {
    return 'controller';
  }
  if (/service(s)?\.(ts|js|tsx|jsx|py)$/.test(normalized) || /(^|\/)services?\//.test(normalized)) {
    return 'service';
  }
  if (/(^|\/)middleware(s)?\//.test(normalized) || /middleware\.(ts|js)$/.test(normalized)) {
    return 'middleware';
  }
  if (/(^|\/)components?\//.test(normalized) && /\.(tsx|jsx|vue|svelte)$/.test(normalized)) {
    return 'component';
  }
  if (/(^|\/)pages?\//.test(normalized) && /\.(tsx|jsx|vue)$/.test(normalized)) {
    return 'page';
  }
  if (/(^|\/)models?\//.test(normalized)) {
    return 'model';
  }
  if (/(^|\/)migrations?\//.test(normalized)) {
    return 'migration';
  }
  if (/(^|\/)hooks?\//.test(normalized) && /\.(ts|tsx|js|jsx)$/.test(normalized)) {
    return 'hook';
  }
  return null;
}

export function findEntryPoints(relativeFiles: string[]): string[] {
  const candidates = [
    /^src\/index\.(ts|js|tsx|jsx)$/,
    /^src\/main\.(ts|js|tsx|jsx)$/,
    /^src\/app\.(ts|js|tsx|jsx)$/,
    /^src\/server\.(ts|js)$/,
    /^index\.(ts|js|tsx|jsx)$/,
    /^main\.(ts|js|tsx|jsx)$/,
    /^app\.(py)$/,
    /^manage\.py$/,
    /^apps\/[^/]+\/src\/index\.(ts|js)$/,
    /^apps\/[^/]+\/src\/pages\/index\.(tsx|jsx)$/,
    /^apps\/[^/]+\/src\/pages\/_app\.(tsx|jsx)$/,
  ];

  const matches = relativeFiles.filter((filePath) =>
    candidates.some((pattern) => pattern.test(normalizeRelativePath(filePath)))
  );

  return [...new Set(matches)].slice(0, 12);
}

export function detectFrameworks(
  relativeFiles: string[],
  packageNames: Set<string>
): { frontend: string | null; backend: string | null } {
  let frontend: string | null = null;
  let backend: string | null = null;

  if (packageNames.has('next') || relativeFiles.some((f) => /\/pages\/|\/app\//.test(f))) {
    frontend = 'Next.js';
  } else if (packageNames.has('react') || packageNames.has('react-dom')) {
    frontend = 'React';
  } else if (packageNames.has('vue')) {
    frontend = 'Vue';
  } else if (packageNames.has('@angular/core')) {
    frontend = 'Angular';
  } else if (packageNames.has('svelte')) {
    frontend = 'Svelte';
  }

  if (packageNames.has('@nestjs/core')) {
    backend = 'NestJS';
  } else if (packageNames.has('express')) {
    backend = 'Express';
  } else if (packageNames.has('fastify')) {
    backend = 'Fastify';
  } else if (packageNames.has('koa')) {
    backend = 'Koa';
  } else if (relativeFiles.some((f) => /django|flask|fastapi/i.test(f))) {
    backend = 'Python Web';
  }

  return { frontend, backend };
}

export function collectByRole(relativeFiles: string[], role: string, limit = 20): string[] {
  return relativeFiles
    .filter((filePath) => inferRoleFromPath(filePath) === role)
    .slice(0, limit)
    .map((filePath) => basenameNoExt(filePath));
}

export function uniqueSymbols(parsedData: ParsedFileRecord[], kind: 'route' | 'controller' | 'service'): string[] {
  const patterns: Record<string, RegExp[]> = {
    route: [/route/i, /router/i, /get\(|post\(|put\(|delete\(/i],
    controller: [/controller/i],
    service: [/service/i],
  };

  const names = new Set<string>();
  for (const file of parsedData) {
    const relative = normalizeRelativePath(file.filePath);
    const role = inferRoleFromPath(relative);
    if (role === kind || patterns[kind].some((p) => p.test(relative))) {
      names.add(basenameNoExt(relative));
      for (const exp of file.exports) {
        if (exp && exp !== 'default') names.add(exp);
      }
    }
  }
  return Array.from(names).slice(0, 20);
}
