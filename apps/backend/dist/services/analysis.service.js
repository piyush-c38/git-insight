"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisService = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const github_service_1 = require("./github.service");
const parser_service_1 = require("./parser.service");
const embedding_service_1 = require("./embedding.service");
const vector_service_1 = require("./vector.service");
const errors_1 = require("../lib/errors");
function readPackageJson(localPath) {
    const packageJsonPath = path_1.default.join(localPath, 'package.json');
    if (!fs_1.default.existsSync(packageJsonPath)) {
        return undefined;
    }
    try {
        const raw = fs_1.default.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(raw);
    }
    catch (error) {
        console.warn('Failed to read package.json from analyzed repository:', error);
        return undefined;
    }
}
class AnalysisService {
    constructor() {
        this.analyses = new Map();
    }
    async startAnalysis(repoUrl) {
        const analysisId = (0, crypto_1.randomUUID)();
        this.analyses.set(analysisId, {
            analysisId,
            repoUrl,
            status: 'pending',
        });
        void this.runAnalysis(analysisId, repoUrl);
        return analysisId;
    }
    getAnalysisResult(analysisId) {
        return this.analyses.get(analysisId);
    }
    async runAnalysis(analysisId, repoUrl) {
        this.analyses.set(analysisId, {
            analysisId,
            repoUrl,
            status: 'processing',
        });
        try {
            const result = await this.analyzeRepo(repoUrl);
            this.analyses.set(analysisId, {
                analysisId,
                repoUrl,
                status: 'completed',
                ...result,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.analyses.set(analysisId, {
                analysisId,
                repoUrl,
                status: 'failed',
                error: message,
            });
        }
    }
    async analyzeRepo(repoUrl) {
        try {
            const localPath = await github_service_1.githubService.cloneRepo(repoUrl);
            const files = await github_service_1.githubService.scanFiles(localPath);
            const repoMetadata = await github_service_1.githubService.fetchRepoMetadata(repoUrl);
            const packageJson = readPackageJson(localPath);
            const collectionName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');
            const parsedData = [];
            for (const file of files) {
                const data = await parser_service_1.parserService.parseFile(file);
                if (data) {
                    parsedData.push(data);
                }
            }
            const embeddings = await embedding_service_1.embeddingService.generateEmbeddingsForFiles(files);
            const documents = embeddings.map((emb, index) => ({
                id: `${emb.filePath}-${index}`,
                embedding: emb.embedding,
                document: emb.content,
                metadata: {
                    filePath: emb.filePath,
                },
            }));
            await vector_service_1.vectorService.addDocuments(collectionName, documents);
            const dependencies = parsedData.reduce((acc, data) => {
                return { ...acc, [data.filePath]: data.dependencies };
            }, {});
            return {
                message: 'Analysis complete',
                collectionName,
                repoMetadata,
                packageJson,
                dependencies,
                files,
                parsedData,
            };
        }
        catch (error) {
            console.error('Repository analysis failed:', error);
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            throw new errors_1.ApiError(500, 'Repository analysis failed');
        }
    }
}
exports.analysisService = new AnalysisService();
