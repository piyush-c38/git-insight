import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import config from '../../config';
import { analysisService } from '../../services/analysis.service';
import { ragService } from '../../services/rag.service';
import { getRepoCloneName } from '../../services/github.service';

export async function startAnalysis(req: Request, res: Response) {
  const { repoUrl } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ message: 'repoUrl is required' });
  }

  try {
    const analysisId = await analysisService.startAnalysis(repoUrl);
    res.status(202).json({ analysisId, status: 'pending' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to start analysis' });
  }
}

export async function getAnalysis(req: Request, res: Response) {
  const { analysisId } = req.params;
  const result = analysisService.getAnalysisResult(analysisId);

  if (!result) {
    return res.status(404).json({ message: 'Analysis not found' });
  }

  res.json(result);
}

export async function chatWithRepo(req: Request, res: Response) {
  const { analysisId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'message is required' });
  }

  const analysis = analysisService.getAnalysisResult(analysisId);
  if (!analysis) {
    return res.status(404).json({ message: 'Analysis not found' });
  }

  if (analysis.status !== 'completed') {
    return res.status(400).json({ message: 'Analysis is not complete' });
  }

  if (!analysis.collectionName) {
    return res.status(500).json({ message: 'Analysis collection is missing' });
  }

  try {
    const reply = await ragService.getRagResponse(message, analysis.collectionName, {
      repoUrl: analysis.repoUrl,
      repoMetadata: analysis.repoMetadata,
      packageJson: analysis.packageJson,
      files: analysis.files,
    });
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during chat' });
  }
}

export async function getFile(req: Request, res: Response) {
  const { analysisId } = req.params;
  const { path: filePath } = req.query;

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ message: 'File path query parameter is required' });
  }

  const analysis = analysisService.getAnalysisResult(analysisId);
  if (!analysis) return res.status(404).json({ message: 'Analysis not found' });

  try {
    const repoUrl = analysis.repoUrl;
    const repoName = getRepoCloneName(repoUrl);
    const localPath = path.join(config.clonePath!, repoName);
    const absolutePath = path.join(localPath, filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found in cloned repository' });
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    res.json({ filePath, content });
  } catch (error) {
    console.error('Error reading file from cloned repo:', error);
    res.status(500).json({ message: 'Failed to read file' });
  }
}