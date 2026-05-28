"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parserService = void 0;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_javascript_1 = __importDefault(require("tree-sitter-javascript"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const babelParser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
class ParserService {
    constructor() {
        this.parser = new tree_sitter_1.default();
    }
    getLanguage(filePath) {
        const extension = path_1.default.extname(filePath);
        switch (extension) {
            case '.js':
            case '.jsx':
            case '.ts':
            case '.tsx':
                return tree_sitter_javascript_1.default;
            case '.py':
                return tree_sitter_python_1.default;
            default:
                return null;
        }
    }
    parseWithTreeSitter(filePath, language) {
        this.parser.setLanguage(language);
        const sourceCode = fs_1.default.readFileSync(filePath, 'utf8');
        return this.parser.parse(sourceCode);
    }
    extractDependenciesBabel(filePath) {
        const sourceCode = fs_1.default.readFileSync(filePath, 'utf8');
        const dependencies = [];
        const exports = [];
        const ast = babelParser.parse(sourceCode, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
        (0, traverse_1.default)(ast, {
            ImportDeclaration({ node }) {
                dependencies.push(node.source.value);
            },
            CallExpression({ node }) {
                if (node.callee.type === 'Identifier' &&
                    node.callee.name === 'require' &&
                    node.arguments.length > 0 &&
                    node.arguments[0].type === 'StringLiteral') {
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
                    }
                    else if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
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
    async parseFile(filePath) {
        const language = this.getLanguage(filePath);
        if (!language) {
            return null;
        }
        let dependencies = [];
        let exports = [];
        if (language === tree_sitter_javascript_1.default) {
            const result = this.extractDependenciesBabel(filePath);
            dependencies = result.dependencies;
            exports = result.exports;
        }
        else {
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
exports.parserService = new ParserService();
