import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { githubService } from './github.service';
import { parserService } from './parser.service';
import { chunkService } from './chunk.service';
import { embeddingService } from './embedding.service';
import { vectorService } from './vector.service';
import { ApiError } from '../lib/errors';
import { computeRepoSizeStats, logAnalysisSummary, logStageDuration } from '../lib/perf';
import { yieldEvery } from '../lib/async-utils';
import { filterEmbeddablePaths } from '../lib/embeddable-files';
import { knowledgeGeneratorService } from './knowledge/knowledge-generator.service';
import { RepositoryKnowledge } from '../types/knowledge';

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type AnalysisStep =
  | 'pending'
  | 'cloning'
  | 'scanning'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'failed'
  | 'cancelled';

type AnalysisStatusWithCancel = AnalysisStatus;

class CancelledAnalysisError extends Error {
  constructor() {
    super('Analysis cancelled');
    this.name = 'CancelledAnalysisError';
  }
}

export interface AnalysisRecord {
  analysisId: string;
  repoUrl: string;
  status: AnalysisStatusWithCancel;
  step?: AnalysisStep;
  progress?: number;
  chunksTotal?: number;
  chunksProcessed?: number;
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
  knowledge?: RepositoryKnowledge;
  error?: string;
}

export interface AnalysisStatusResponse {
  analysisId: string;
  status: AnalysisStatusWithCancel;
  step: AnalysisStep;
  progress: number;
  chunksTotal?: number;
  chunksProcessed?: number;
  message?: string;
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

function mapProgress(step: AnalysisStep, ratio = 0): number {
  const bounds: Record<AnalysisStep, [number, number]> = {
    pending: [0, 0],
    cloning: [0, 12],
    scanning: [12, 18],
    parsing: [18, 32],
    chunking: [32, 38],
    embedding: [38, 92],
    storing: [92, 98],
    completed: [100, 100],
    failed: [0, 0],
    cancelled: [0, 0],
  };

  const [start, end] = bounds[step];
  if (step === 'completed') return 100;
  return Math.min(end, Math.round(start + (end - start) * Math.min(1, Math.max(0, ratio))));
}

class AnalysisService {
  private analyses = new Map<string, AnalysisRecord>();

  private isCancelled(analysisId: string): boolean {
    return this.analyses.get(analysisId)?.status === 'cancelled';
  }

  private throwIfCancelled(analysisId: string) {
    if (this.isCancelled(analysisId)) {
      throw new CancelledAnalysisError();
    }
  }

  private updateProgress(
    analysisId: string,
    patch: Pick<AnalysisRecord, 'step' | 'progress' | 'chunksTotal' | 'chunksProcessed' | 'message'>
  ) {
    const current = this.analyses.get(analysisId);
    if (!current) return;

    this.analyses.set(analysisId, {
      ...current,
      ...patch,
    });
  }

  async startAnalysis(repoUrl: string): Promise<string> {
    const analysisId = randomUUID();
    this.analyses.set(analysisId, {
      analysisId,
      repoUrl,
      status: 'pending',
      step: 'pending',
      progress: 0,
    });

    void this.runAnalysis(analysisId, repoUrl);
    return analysisId;
  }

  getAnalysisResult(analysisId: string): AnalysisRecord | undefined {
    return this.analyses.get(analysisId);
  }

  getAnalysisStatus(analysisId: string): AnalysisStatusResponse | undefined {
    const record = this.analyses.get(analysisId);
    if (!record) return undefined;

    return {
      analysisId: record.analysisId,
      status: record.status,
      step:
        record.step ??
        (record.status === 'processing' ? 'cloning' : record.status === 'pending' ? 'pending' : record.status),
      progress: record.progress ?? (record.status === 'completed' ? 100 : 0),
      chunksTotal: record.chunksTotal,
      chunksProcessed: record.chunksProcessed,
      message: record.message,
      error: record.error,
    };
  }

  private async runAnalysis(analysisId: string, repoUrl: string) {
    console.time('Entire Repository Analysis Request');

    this.analyses.set(analysisId, {
      analysisId,
      repoUrl,
      status: 'processing',
      step: 'cloning',
      progress: mapProgress('cloning', 0),
    });

    try {
      const result = await this.analyzeRepo(analysisId, repoUrl);
      if (this.isCancelled(analysisId)) {
        this.analyses.set(analysisId, {
          analysisId,
          repoUrl,
          status: 'cancelled',
          step: 'cancelled',
          progress: 0,
          message: 'Analysis cancelled',
        });
        console.timeEnd('Entire Repository Analysis Request');
        return;
      }

      console.time('Final Response Assembly');
      this.analyses.set(analysisId, {
        analysisId,
        repoUrl,
        status: 'completed',
        step: 'completed',
        progress: 100,
        ...result,
      });
      console.timeEnd('Final Response Assembly');
      console.timeEnd('Entire Repository Analysis Request');
    } catch (error) {
      console.timeEnd('Entire Repository Analysis Request');

      if (error instanceof CancelledAnalysisError || this.isCancelled(analysisId)) {
        this.analyses.set(analysisId, {
          analysisId,
          repoUrl,
          status: 'cancelled',
          step: 'cancelled',
          progress: 0,
          message: 'Analysis cancelled',
        });
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.analyses.set(analysisId, {
        analysisId,
        repoUrl,
        status: 'failed',
        step: 'failed',
        progress: 0,
        error: message,
      });
    }
  }

  cancelAnalysis(analysisId: string): AnalysisRecord | undefined {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) {
      return undefined;
    }

    if (analysis.status === 'completed' || analysis.status === 'failed') {
      return analysis;
    }

    const cancelledAnalysis = {
      ...analysis,
      status: 'cancelled' as const,
      step: 'cancelled' as const,
      progress: 0,
      message: 'Analysis cancelled',
    };

    this.analyses.set(analysisId, cancelledAnalysis);
    return cancelledAnalysis;
  }

  async analyzeRepo(analysisId: string, repoUrl: string) {
    const pipelineStartMs = performance.now();
    let filesProcessed = 0;
    let chunksGenerated = 0;
    let embeddingsGenerated = 0;
    let vectorsInserted = 0;

    try {
      this.throwIfCancelled(analysisId);

      this.updateProgress(analysisId, {
        step: 'cloning',
        progress: mapProgress('cloning', 0.1),
      });
      const localPath = await githubService.cloneRepo(repoUrl);
      this.throwIfCancelled(analysisId);

      this.updateProgress(analysisId, {
        step: 'scanning',
        progress: mapProgress('scanning', 0.2),
      });
      console.time('File Discovery/Scanning');
      const files = await githubService.scanFiles(localPath, () => this.isCancelled(analysisId));
      console.timeEnd('File Discovery/Scanning');
      filesProcessed = files.length;
      const repoSize = computeRepoSizeStats(files);
      const embeddableFiles = filterEmbeddablePaths(files);
      this.throwIfCancelled(analysisId);

      const relativeFiles = files.map((filePath) => toRelativePath(localPath, filePath));
      this.throwIfCancelled(analysisId);

      const repoMetadata = await githubService.fetchRepoMetadata(repoUrl);
      this.throwIfCancelled(analysisId);

      const packageJson = readPackageJson(localPath);
      const collectionName = repoUrl.replace(/[^a-zA-Z0-9]/g, '_');

      this.updateProgress(analysisId, {
        step: 'parsing',
        progress: mapProgress('parsing', 0),
      });

      parserService.resetParseMetrics();
      const parsedData: Array<{ filePath: string; dependencies: string[]; exports: string[] }> = [];
      const parseTargets = files.filter((filePath) => /\.(js|jsx|ts|tsx|py)$/i.test(filePath));

      await yieldEvery(parseTargets, 5, async (file) => {
        this.throwIfCancelled(analysisId);
        const data = await parserService.parseFile(file);
        if (data) {
          parsedData.push(data);
        }
      });

      const parseMetrics = parserService.getParseMetrics();
      logStageDuration('Tree-sitter Parsing', parseMetrics.treeSitterMs);
      logStageDuration('Babel/TypeScript AST Parsing', parseMetrics.babelMs);
      this.throwIfCancelled(analysisId);

      this.updateProgress(analysisId, {
        step: 'chunking',
        progress: mapProgress('chunking', 0.5),
        message: 'Generating embeddings and repository knowledge in parallel',
      });
      this.throwIfCancelled(analysisId);

      const embeddingPipeline = async () => {
        const { chunks } = chunkService.generateChunksForFiles(embeddableFiles);
        chunksGenerated = chunks.length;
        this.updateProgress(analysisId, {
          step: 'embedding',
          progress: mapProgress('embedding', 0),
          chunksTotal: chunks.length,
          chunksProcessed: 0,
        });
        this.throwIfCancelled(analysisId);

        const embeddingResult = await embeddingService.generateEmbeddingsForChunks(
          chunks,
          () => this.isCancelled(analysisId),
          ({ chunksProcessed, chunksTotal }) => {
            this.updateProgress(analysisId, {
              step: 'embedding',
              progress: mapProgress('embedding', chunksTotal > 0 ? chunksProcessed / chunksTotal : 0),
              chunksTotal,
              chunksProcessed,
            });
          }
        );

        embeddingsGenerated = embeddingResult.embeddings.length;
        const embeddings = embeddingResult.embeddings;
        this.throwIfCancelled(analysisId);

        if (embeddings.length === 0 && this.isCancelled(analysisId)) {
          throw new CancelledAnalysisError();
        }

        this.updateProgress(analysisId, {
          step: 'storing',
          progress: mapProgress('storing', 0.2),
          chunksProcessed: embeddings.length,
          chunksTotal: chunks.length,
        });

        const documents = embeddings.map((emb, index) => ({
          id: `${emb.filePath}-${emb.symbolName ?? 'chunk'}-${index}`,
          embedding: emb.embedding,
          document: emb.content,
          metadata: {
            filePath: toRelativePath(localPath, emb.filePath),
            symbolName: emb.symbolName,
            symbolType: emb.symbolType,
          },
        }));

        vectorsInserted = documents.length;
        await vectorService.addDocuments(collectionName, documents);
      };

      const knowledgePipeline = async () => {
        console.time('Repository Knowledge Generation');
        const knowledge = knowledgeGeneratorService.generateAll({
          repoRoot: localPath,
          relativeFiles,
          parsedData,
          packageJson,
          repoLanguages: repoMetadata?.techStack ?? [],
        });
        console.timeEnd('Repository Knowledge Generation');
        return knowledge;
      };

      console.time('Parallel Analysis Phase');
      const [, knowledge] = await Promise.all([embeddingPipeline(), knowledgePipeline()]);
      console.timeEnd('Parallel Analysis Phase');

      console.time('Dependency Graph Generation');
      const dependencies = parsedData.reduce<Record<string, string[]>>((acc, data) => {
        acc[toRelativePath(localPath, data.filePath)] = data.dependencies;
        return acc;
      }, {});
      console.timeEnd('Dependency Graph Generation');

      logAnalysisSummary({
        filesProcessed,
        chunksGenerated,
        embeddingsGenerated,
        vectorsInserted,
        repoSize,
        totalExecutionMs: performance.now() - pipelineStartMs,
        treeSitterParsingMs: parseMetrics.treeSitterMs,
        treeSitterFiles: parseMetrics.treeSitterFiles,
        babelParsingMs: parseMetrics.babelMs,
        babelFiles: parseMetrics.babelFiles,
      });

      return {
        message: 'Analysis complete',
        collectionName,
        repoMetadata,
        packageJson,
        dependencies,
        files: relativeFiles,
        parsedData,
        knowledge,
      };
    } catch (error) {
      if (error instanceof CancelledAnalysisError || this.isCancelled(analysisId)) {
        throw new CancelledAnalysisError();
      }

      console.error('Repository analysis failed:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Repository analysis failed');
    }
  }
}

export const analysisService = new AnalysisService();
