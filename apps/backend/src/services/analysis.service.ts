import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { githubService } from './github.service';
import { parserService } from './parser.service';
import { embeddingService } from './embedding.service';
import { vectorService } from './vector.service';
import { ApiError } from '../lib/errors';

type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface AnalysisRecord {
  analysisId: string;
  repoUrl: string;
  status: AnalysisStatus;
  message?: string;
  collectionName?: string;
  repoMetadata?: {
    stars: number;
    forks: number;
    techStack: string[];
  };
  packageJson?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  files?: string[];
  parsedData?: unknown[];
  error?: string;
}

function readPackageJson(localPath: string): Record<string, unknown> | undefined {
  const packageJsonPath = path.join(localPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    console.warn('Failed to read package.json from analyzed repository:', error);
    return undefined;
  }
}

function toRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
}

class AnalysisService {
  private analyses = new Map<string, AnalysisRecord>();

  async startAnalysis(repoUrl: string): Promise<string> {
    const analysisId = randomUUID();
    this.analyses.set(analysisId, {
      analysisId,
      repoUrl,
      status: 'pending',
    });

    void this.runAnalysis(analysisId, repoUrl);
    return analysisId;
  }

  getAnalysisResult(analysisId: string): AnalysisRecord | undefined {
    return this.analyses.get(analysisId);
  }

  private async runAnalysis(analysisId: string, repoUrl: string) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.analyses.set(analysisId, {
        analysisId,
        repoUrl,
        status: 'failed',
        error: message,
      });
    }
  }

  async analyzeRepo(repoUrl: string) {
    try {
      const localPath = await githubService.cloneRepo(repoUrl);
      const files = await githubService.scanFiles(localPath);
      const relativeFiles = files.map((filePath) => toRelativePath(localPath, filePath));
      const repoMetadata = await githubService.fetchRepoMetadata(repoUrl);
      const packageJson = readPackageJson(localPath);
      const collectionName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');

      const parsedData = [];
      for (const file of files) {
        const data = await parserService.parseFile(file);
        if (data) {
          parsedData.push(data);
        }
      }

      const embeddings = await embeddingService.generateEmbeddingsForFiles(files);

      const documents = embeddings.map((emb, index) => ({
        id: `${emb.filePath}-${index}`,
        embedding: emb.embedding,
        document: emb.content,
        metadata: {
          filePath: toRelativePath(localPath, emb.filePath),
        },
      }));

      await vectorService.addDocuments(collectionName, documents);

      const dependencies = parsedData.reduce((acc, data) => {
        return { ...acc, [data.filePath]: data.dependencies };
      }, {});

      return {
        message: 'Analysis complete',
        collectionName,
        repoMetadata,
        packageJson,
        dependencies,
        files: relativeFiles,
        parsedData,
      };
    } catch (error) {
      console.error('Repository analysis failed:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Repository analysis failed');
    }
  }
}

export const analysisService = new AnalysisService();
