"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragService = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const config_1 = __importDefault(require("../config"));
const embedding_service_1 = require("./embedding.service");
const vector_service_1 = require("./vector.service");
const errors_1 = require("../lib/errors");
class RagService {
    constructor() {
        if (!config_1.default.groqApiKey) {
            throw new Error('Groq API key is not configured');
        }
        this.groq = new groq_sdk_1.default({ apiKey: config_1.default.groqApiKey });
    }
    async getRagResponse(query, collectionName) {
        try {
            const queryEmbedding = await embedding_service_1.embeddingService.generateEmbeddings(query);
            const contextResults = await vector_service_1.vectorService.query(collectionName, queryEmbedding);
            const contextDocuments = contextResults.documents?.[0] || [];
            const context = contextDocuments.join('\n\n');
            const prompt = `
        Context:
        ${context}
        
        Question: ${query}
        
        Answer:
      `;
            const completion = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: config_1.default.groqModel,
            });
            return completion.choices[0]?.message?.content || "Sorry, I couldn't find an answer.";
        }
        catch (error) {
            console.error('RAG service failed:', error);
            throw new errors_1.ApiError(500, 'Failed to get RAG response');
        }
    }
}
exports.ragService = new RagService();
