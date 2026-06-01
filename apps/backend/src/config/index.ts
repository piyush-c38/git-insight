import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  githubToken: process.env.GITHUB_TOKEN,
  chromaUrl: process.env.CHROMA_URL,
  clonePath: process.env.CLONE_PATH || '/tmp/ai-github-explainer-clones',
  tavilyApiKey: process.env.TAVILY_API_KEY,
  tavilyApiUrl: process.env.TAVILY_API_URL,
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL,
  port: process.env.PORT || 3001,
};

export default config;
