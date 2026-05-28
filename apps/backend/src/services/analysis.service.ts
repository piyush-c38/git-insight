import { githubService } from './github.service';
import { parserService } from './parser.service';
import { embeddingService } from './embedding.service';
import { vectorService } from './vector.service';
import { ApiError } from '../lib/errors';

class AnalysisService {
  async analyzeRepo(repoUrl: string) {
    try {
      const localPath = await githubService.cloneRepo(repoUrl);
      const files = await githubService.scanFiles(localPath);
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
        metadata: {
          filePath: emb.filePath,
          content: emb.content,
        },
      }));

      await vectorService.addDocuments(collectionName, documents);

      const dependencies = parsedData.reduce((acc, data) => {
        return { ...acc, [data.filePath]: data.dependencies };
      }, {});

      return {
        message: 'Analysis complete',
        collectionName,
        dependencies,
        files,
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
