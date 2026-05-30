"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const config = {
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    githubToken: process.env.GITHUB_TOKEN,
    chromaUrl: process.env.CHROMA_URL,
    clonePath: process.env.CLONE_PATH || '/tmp/ai-github-explainer-clones',
    port: process.env.PORT || 3001,
};
exports.default = config;
