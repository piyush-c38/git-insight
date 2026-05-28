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

class ParserService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
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
    this.parser.setLanguage(language);
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    return this.parser.parse(sourceCode);
  }

  private extractDependenciesBabel(filePath: string): { dependencies: string[], exports: string[] } {
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
