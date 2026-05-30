"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = void 0;
const transformers_1 = require("@xenova/transformers");
const fs_1 = __importDefault(require("fs"));
// Skip local model check
transformers_1.env.allowLocalModels = false;
class EmbeddingService {
    constructor() {
        this.init();
    }
    async init() {
        this.pipe = await (0, transformers_1.pipeline)('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    async generateEmbeddings(text) {
        if (!this.pipe) {
            await this.init();
        }
        const result = await this.pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }
    async generateEmbeddingsForFiles(filePaths) {
        const embeddings = [];
        for (const filePath of filePaths) {
            const rawContent = fs_1.default.readFileSync(filePath, 'utf-8');
            if (rawContent.includes('\u0000')) {
                continue;
            }
            const content = this.sanitizeText(rawContent);
            // Simple chunking for now
            const chunks = this.chunkText(content);
            for (const chunk of chunks) {
                const embedding = await this.generateEmbeddings(chunk);
                embeddings.push({ filePath, content: chunk, embedding });
            }
        }
        return embeddings;
    }
    sanitizeText(text) {
        const withoutControls = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
        const escapedBackslashes = withoutControls.replace(/\\/g, '\\\\');
        return escapedBackslashes.replace(/\\x[0-9A-Fa-f]{0,2}/g, '');
    }
    chunkText(text, chunkSize = 512, overlap = 50) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize - overlap) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }
}
exports.embeddingService = new EmbeddingService();
