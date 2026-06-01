import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import fs from 'fs';
import path from 'path';
import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';

interface ParsedData {
  filePath: string;
  dependencies: string[];
  exports: string[];
}

export type ParseMetrics = {
  treeSitterMs: number;
  treeSitterFiles: number;
  babelMs: number;
  babelFiles: number;
};

class ParserService {
  private parser: Parser;
  private treeSitterMs = 0;
  private treeSitterFiles = 0;
  private babelMs = 0;
  private babelFiles = 0;

  constructor() {
    this.parser = new Parser();
  }

  resetParseMetrics(): void {
    this.treeSitterMs = 0;
    this.treeSitterFiles = 0;
    this.babelMs = 0;
    this.babelFiles = 0;
  }

  getParseMetrics(): ParseMetrics {
    return {
      treeSitterMs: this.treeSitterMs,
      treeSitterFiles: this.treeSitterFiles,
      babelMs: this.babelMs,
      babelFiles: this.babelFiles,
    };
  }

  private getLanguage(filePath: string): any {
    const extension = path.extname(filePath);
    switch (extension) {
      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        return JavaScript;
      case '.py':
        return Python;
      default:
        return null;
    }
  }

  private parseWithTreeSitter(filePath: string, language: any): Parser.Tree {
    const startMs = performance.now();
    this.parser.setLanguage(language);
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    const tree = this.parser.parse(sourceCode);
    this.treeSitterMs += performance.now() - startMs;
    this.treeSitterFiles += 1;
    return tree;
  }

  private extractDependenciesBabel(filePath: string): { dependencies: string[], exports: string[] } {
    const startMs = performance.now();
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    const dependencies: string[] = [];
    const exports: string[] = [];
    const ast = babelParser.parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      ImportDeclaration({ node }) {
        dependencies.push(node.source.value);
      },
      CallExpression({ node }) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'StringLiteral'
        ) {
          dependencies.push(node.arguments[0].value);
        }
      },
      ExportNamedDeclaration({ node }) {
        if (node.specifiers) {
          node.specifiers.forEach(spec => {
            if (spec.type === 'ExportSpecifier') {
              exports.push(spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value);
            }
          });
        }
        if (node.declaration) {
            if (node.declaration.type === 'VariableDeclaration') {
                node.declaration.declarations.forEach(decl => {
                    if (decl.id.type === 'Identifier') {
                        exports.push(decl.id.name);
                    }
                });
            } else if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
                if (node.declaration.id) {
                    exports.push(node.declaration.id.name);
                }
            }
        }
      },
      ExportDefaultDeclaration({ node }) {
        exports.push('default');
      },
    });

    this.babelMs += performance.now() - startMs;
    this.babelFiles += 1;
    return { dependencies, exports };
  }

  async parseFile(filePath: string): Promise<ParsedData | null> {
    const language = this.getLanguage(filePath);
    if (!language) {
      return null;
    }

    let dependencies: string[] = [];
    let exports: string[] = [];
    if (language === JavaScript) {
      const result = this.extractDependenciesBabel(filePath);
      dependencies = result.dependencies;
      exports = result.exports;
    } else {
      const tree = this.parseWithTreeSitter(filePath, language);
      // Basic dependency extraction for other languages can be added here
    }

    return {
      filePath,
      dependencies,
      exports,
    };
  }
}

export const parserService = new ParserService();
