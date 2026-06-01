import fs from 'fs';
import path from 'path';
import * as babelParser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isEmbeddableFile, isEmbeddableFileWithinSize } from '../lib/embeddable-files';
import { logStageDuration } from '../lib/perf';

export type CodeChunkKind =
  | 'function'
  | 'class'
  | 'component'
  | 'hook'
  | 'route'
  | 'service'
  | 'module';

export type CodeChunk = {
  filePath: string;
  content: string;
  symbolName: string;
  symbolType: CodeChunkKind;
  startLine: number;
  endLine: number;
};

const MAX_CHUNKS_TOTAL = 1000;
const MAX_CHUNKS_PER_FILE = 6;
const MAX_CHUNK_CHARS = 2400;
const MIN_CHUNK_CHARS = 48;

const KIND_PRIORITY: Record<CodeChunkKind, number> = {
  route: 0,
  component: 1,
  service: 2,
  class: 3,
  hook: 4,
  function: 5,
  module: 6,
};

type RawChunk = CodeChunk & { priority: number };

function sanitizeText(text: string): string {
  const withoutControls = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const escapedBackslashes = withoutControls.replace(/\\/g, '\\\\');
  return escapedBackslashes.replace(/\\x[0-9A-Fa-f]{0,2}/g, '');
}

function sliceByLoc(source: string, startLine: number, endLine: number): string {
  const lines = source.split('\n');
  const slice = lines.slice(Math.max(0, startLine - 1), endLine).join('\n');
  if (slice.length <= MAX_CHUNK_CHARS) {
    return slice;
  }
  return `${slice.slice(0, MAX_CHUNK_CHARS)}\n/* … truncated */`;
}

function hasJsx(fnPath: NodePath<t.Function | t.ArrowFunctionExpression | t.Class>): boolean {
  let found = false;
  fnPath.traverse({
    JSXElement() {
      found = true;
    },
    JSXFragment() {
      found = true;
    },
  });
  return found;
}

function getSymbolName(node: t.Node): string {
  if (t.isIdentifier(node)) return node.name;
  if (t.isStringLiteral(node)) return node.value;
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  if (t.isClassDeclaration(node) && node.id) return node.id.name;
  return 'anonymous';
}

function inferKind(
  filePath: string,
  symbolName: string,
  node: t.Node,
  _nodePath: NodePath<t.Node>,
  hasJsxReturn: boolean
): CodeChunkKind {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();

  if (
    /\/(api|routes?)\//.test(normalized) ||
    /pages\/api\//.test(normalized) ||
    baseName.includes('route')
  ) {
    if (t.isCallExpression(node) || t.isFunctionDeclaration(node) || t.isArrowFunctionExpression(node)) {
      return 'route';
    }
  }

  if (/\.service\.(ts|js|tsx|jsx)$/.test(baseName) || /service\.(ts|js|tsx|jsx)$/.test(baseName)) {
    return 'service';
  }

  if (symbolName.endsWith('Service') && (t.isClassDeclaration(node) || t.isClassExpression(node))) {
    return 'service';
  }

  if (/^use[A-Z]/.test(symbolName)) {
    return 'hook';
  }

  if (hasJsxReturn || (/^[A-Z]/.test(symbolName) && (t.isFunction(node) || t.isClass(node)))) {
    return 'component';
  }

  if (t.isClassDeclaration(node) || t.isClassExpression(node)) {
    return 'class';
  }

  if (t.isFunctionDeclaration(node) || t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return 'function';
  }

  return 'function';
}

function isExpressRouteHandler(path: NodePath<t.CallExpression>): boolean {
  if (!t.isMemberExpression(path.node.callee)) return false;
  const property = path.node.callee.property;
  if (!t.isIdentifier(property)) return false;
  return ['get', 'post', 'put', 'patch', 'delete', 'use', 'all'].includes(property.name);
}

function addRawChunk(
  chunks: RawChunk[],
  filePath: string,
  source: string,
  symbolName: string,
  symbolType: CodeChunkKind,
  startLine: number,
  endLine: number
): void {
  if (!startLine || !endLine || endLine < startLine) return;

  const body = sliceByLoc(source, startLine, endLine);
  if (body.trim().length < MIN_CHUNK_CHARS) return;

  const header = `// ${symbolType}: ${symbolName}\n`;
  const content = sanitizeText(`${header}${body}`);
  if (content.length < MIN_CHUNK_CHARS) return;

  chunks.push({
    filePath,
    content,
    symbolName,
    symbolType,
    startLine,
    endLine,
    priority: KIND_PRIORITY[symbolType],
  });
}

function extractFromAst(filePath: string, source: string): RawChunk[] {
  const ast = babelParser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });

  const chunks: RawChunk[] = [];

  const visitFunctionLike = (
    path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
    symbolName: string
  ) => {
    if (!path.node.loc) return;
    const hasJsxReturn = hasJsx(path as NodePath<t.Function | t.ArrowFunctionExpression>);
    const symbolType = inferKind(filePath, symbolName, path.node, path, hasJsxReturn);
    addRawChunk(
      chunks,
      filePath,
      source,
      symbolName,
      symbolType,
      path.node.loc.start.line,
      path.node.loc.end.line
    );
  };

  traverse(ast, {
    FunctionDeclaration(path) {
      const name = path.node.id?.name ?? 'anonymous';
      visitFunctionLike(path, name);
    },
    ClassDeclaration(path) {
      if (!path.node.loc) return;
      const name = path.node.id?.name ?? 'AnonymousClass';
      const symbolType = inferKind(filePath, name, path.node, path, false);
      addRawChunk(
        chunks,
        filePath,
        source,
        name,
        symbolType,
        path.node.loc.start.line,
        path.node.loc.end.line
      );
    },
    ClassMethod(path) {
      if (!path.node.loc) return;
      const classParent = path.findParent((parent) => parent.isClassDeclaration());
      const className =
        classParent?.isClassDeclaration() && classParent.node.id ? classParent.node.id.name : 'Class';
      const methodName = t.isIdentifier(path.node.key)
        ? path.node.key.name
        : t.isStringLiteral(path.node.key)
          ? path.node.key.value
          : 'method';
      const symbolName = `${className}.${methodName}`;
      const hasJsxReturn = hasJsx(path as NodePath<t.Function | t.ArrowFunctionExpression | t.Class>);
      const symbolType = inferKind(filePath, symbolName, path.node, path, hasJsxReturn);
      addRawChunk(
        chunks,
        filePath,
        source,
        symbolName,
        symbolType,
        path.node.loc.start.line,
        path.node.loc.end.line
      );
    },
    VariableDeclarator(path) {
      if (!path.node.loc) return;
      if (!t.isIdentifier(path.node.id)) return;

      const name = path.node.id.name;
      if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
        visitFunctionLike(
          path.get('init') as NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
          name
        );
      }
    },
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration;
      if (!declaration?.loc) return;

      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        visitFunctionLike(path.get('declaration') as NodePath<t.FunctionDeclaration>, declaration.id.name);
      } else if (t.isClassDeclaration(declaration) && declaration.id) {
        const classPath = path.get('declaration') as NodePath<t.ClassDeclaration>;
        if (!declaration.loc) return;
        const symbolType = inferKind(filePath, declaration.id.name, declaration, classPath, false);
        addRawChunk(
          chunks,
          filePath,
          source,
          declaration.id.name,
          symbolType,
          declaration.loc.start.line,
          declaration.loc.end.line
        );
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (t.isFunctionDeclaration(declaration) || t.isFunctionExpression(declaration) || t.isArrowFunctionExpression(declaration)) {
        visitFunctionLike(
          path.get('declaration') as NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
          'default'
        );
      } else if (t.isClassDeclaration(declaration) && declaration.loc) {
        addRawChunk(
          chunks,
          filePath,
          source,
          declaration.id?.name ?? 'DefaultExport',
          'class',
          declaration.loc.start.line,
          declaration.loc.end.line
        );
      }
    },
    CallExpression(path) {
      if (!isExpressRouteHandler(path) || !path.node.loc) return;
      const routeName = t.isStringLiteral(path.node.arguments[0])
        ? path.node.arguments[0].value
        : 'handler';
      addRawChunk(
        chunks,
        filePath,
        source,
        `route:${routeName}`,
        'route',
        path.node.loc.start.line,
        path.node.loc.end.line
      );
    },
  });

  return chunks;
}

function moduleFallback(filePath: string, source: string): RawChunk[] {
  const trimmed = source.trim();
  if (!trimmed) return [];

  const lines = source.split('\n');
  const endLine = Math.min(lines.length, 120);
  const body = sliceByLoc(source, 1, endLine);
  const baseName = path.basename(filePath);

  return [
    {
      filePath,
      content: sanitizeText(`// module: ${baseName}\n${body}`),
      symbolName: baseName,
      symbolType: 'module',
      startLine: 1,
      endLine: endLine,
      priority: KIND_PRIORITY.module,
    },
  ];
}

function pythonFallback(filePath: string, source: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  const lines = source.split('\n');
  let currentName = 'module';
  let startLine = 1;
  let buffer: string[] = [];

  const flush = (endLine: number) => {
    if (buffer.join('\n').trim().length < MIN_CHUNK_CHARS) {
      buffer = [];
      return;
    }
    const body = buffer.join('\n');
    const symbolType: CodeChunkKind =
      currentName.startsWith('test_') ? 'function' : /^[A-Z]/.test(currentName) ? 'class' : 'function';
    chunks.push({
      filePath,
      content: sanitizeText(`// ${symbolType}: ${currentName}\n${body.slice(0, MAX_CHUNK_CHARS)}`),
      symbolName: currentName,
      symbolType,
      startLine,
      endLine,
      priority: KIND_PRIORITY[symbolType],
    });
    buffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(async\s+def|def|class)\s+([A-Za-z_][\w]*)/);
    if (match) {
      flush(index);
      currentName = match[2];
      startLine = index + 1;
    }
    buffer.push(line);
    if (buffer.length >= 80) {
      flush(index + 1);
      startLine = index + 2;
    }
  }

  flush(lines.length);
  return chunks.length > 0 ? chunks : moduleFallback(filePath, source);
}

function dedupeChunks(chunks: RawChunk[]): RawChunk[] {
  const seen = new Set<string>();
  const unique: RawChunk[] = [];

  for (const chunk of chunks.sort((a, b) => a.startLine - b.startLine || a.priority - b.priority)) {
    const key = `${chunk.filePath}:${chunk.startLine}:${chunk.endLine}:${chunk.symbolName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
  }

  return unique;
}

function limitPerFile(chunks: RawChunk[]): RawChunk[] {
  const byFile = new Map<string, RawChunk[]>();
  for (const chunk of chunks) {
    const list = byFile.get(chunk.filePath) ?? [];
    list.push(chunk);
    byFile.set(chunk.filePath, list);
  }

  const limited: RawChunk[] = [];
  for (const fileChunks of byFile.values()) {
    const sorted = fileChunks.sort((a, b) => a.priority - b.priority || a.startLine - b.startLine);
    limited.push(...sorted.slice(0, MAX_CHUNKS_PER_FILE));
  }

  return limited;
}

function limitTotal(chunks: RawChunk[]): RawChunk[] {
  if (chunks.length <= MAX_CHUNKS_TOTAL) {
    return chunks;
  }

  const sorted = chunks.sort((a, b) => a.priority - b.priority || a.filePath.localeCompare(b.filePath));
  const capped = sorted.slice(0, MAX_CHUNKS_TOTAL);
  console.warn(
    `[perf] Chunk cap reached: kept ${capped.length} of ${chunks.length} code-aware chunks (max ${MAX_CHUNKS_TOTAL})`
  );
  return capped;
}

function extractChunksFromFile(filePath: string, source: string): RawChunk[] {
  const extension = path.extname(filePath).toLowerCase();

  if (['.ts', '.tsx', '.js', '.jsx'].includes(extension)) {
    try {
      const extracted = dedupeChunks(extractFromAst(filePath, source));
      if (extracted.length > 0) {
        return limitPerFile(extracted);
      }
    } catch (error) {
      console.warn(`[chunk] Babel chunking failed for ${filePath}, using module fallback:`, error);
    }
    return limitPerFile(moduleFallback(filePath, source));
  }

  if (extension === '.py') {
    return limitPerFile(pythonFallback(filePath, source));
  }

  return limitPerFile(moduleFallback(filePath, source));
}

class ChunkService {
  generateChunksForFiles(filePaths: string[]): { chunks: CodeChunk[]; filesChunked: number } {
    console.time('Chunk Generation');
    const startMs = performance.now();
    const allRaw: RawChunk[] = [];

    for (const filePath of filePaths) {
      if (!isEmbeddableFile(filePath)) continue;

      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      if (!isEmbeddableFileWithinSize(filePath, stat.size)) continue;

      const rawContent = fs.readFileSync(filePath, 'utf8');
      if (rawContent.includes('\u0000')) continue;

      allRaw.push(...extractChunksFromFile(filePath, rawContent));
    }

    const capped = limitTotal(limitPerFile(allRaw));
    const chunks: CodeChunk[] = capped.map(({ priority: _priority, ...chunk }) => chunk);

    console.timeEnd('Chunk Generation');
    logStageDuration('Chunk Generation', performance.now() - startMs);
    console.log(
      `[perf] Code-aware chunking: ${chunks.length} chunks from ${filePaths.length} candidate files`
    );

    return { chunks, filesChunked: new Set(chunks.map((chunk) => chunk.filePath)).size };
  }
}

export const chunkService = new ChunkService();
