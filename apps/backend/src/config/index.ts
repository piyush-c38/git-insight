import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const defaultChromaDataPath = path.join(
  process.env.DATA_PATH || process.cwd(),
  'data',
  'chroma'
);

const config = {
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  githubToken: process.env.GITHUB_TOKEN,
  /** Optional. When unset, vectors persist locally at chromaDataPath (no separate Chroma server). */
  chromaUrl: process.env.CHROMA_URL,
  chromaDataPath: process.env.CHROMA_DATA_PATH || defaultChromaDataPath,
  clonePath: process.env.CLONE_PATH || '/tmp/git-insight-clones',
  tavilyApiKey: process.env.TAVILY_API_KEY,
  tavilyApiUrl: process.env.TAVILY_API_URL,
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL,
  port: process.env.PORT || 3001,
};

export default config;
