"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorService = void 0;
const chromadb_1 = require("chromadb");
const errors_1 = require("../lib/errors");
class VectorService {
    constructor() {
        this.collection = null;
        this.client = new chromadb_1.ChromaClient();
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
        const metadatas = documents.map(doc => doc.metadata);
        try {
            await this.collection.add({
                ids,
                embeddings,
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
