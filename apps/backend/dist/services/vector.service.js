"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorService = void 0;
const chromadb_1 = require("chromadb");
const errors_1 = require("../lib/errors");
const config_1 = __importDefault(require("../config"));
class VectorService {
    constructor() {
        this.collection = null;
        if (!config_1.default.chromaUrl) {
            throw new errors_1.ApiError(500, 'CHROMA_URL is not configured');
        }
        this.client = new chromadb_1.ChromaClient({ path: config_1.default.chromaUrl });
    }
    async getOrCreateCollection(name) {
        try {
            this.collection = await this.client.getOrCreateCollection({ name });
            return this.collection;
        }
        catch (error) {
            console.error('Failed to get or create collection:', error);
            throw new errors_1.ApiError(500, 'Failed to get or create ChromaDB collection');
        }
    }
    async addDocuments(collectionName, documents) {
        if (!this.collection || this.collection.name !== collectionName) {
            this.collection = await this.getOrCreateCollection(collectionName);
        }
        const ids = documents.map(doc => doc.id);
        const embeddings = documents.map(doc => doc.embedding);
        const texts = documents.map(doc => doc.document);
        const metadatas = documents.map(doc => doc.metadata);
        try {
            await this.collection.add({
                ids,
                embeddings,
                documents: texts,
                metadatas,
            });
        }
        catch (error) {
            console.error('Failed to add documents to ChromaDB:', error);
            throw new errors_1.ApiError(500, 'Failed to add documents to ChromaDB');
        }
    }
    async query(collectionName, queryEmbedding, nResults = 5) {
        if (!this.collection || this.collection.name !== collectionName) {
            this.collection = await this.getOrCreateCollection(collectionName);
        }
        try {
            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults,
            });
            return results;
        }
        catch (error) {
            console.error('Failed to query ChromaDB:', error);
            throw new errors_1.ApiError(500, 'Failed to query ChromaDB');
        }
    }
}
exports.vectorService = new VectorService();
