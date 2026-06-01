import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import config from '../config';
import { ApiError } from '../lib/errors';

interface RepoMetadata {
  stars: number;
  forks: number;
  techStack: string[];
}

export function getRepoCloneName(repoUrl: string) {
  const cleanedUrl = repoUrl.replace(/\.git$/, '');
  const match = cleanedUrl.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);

  if (!match) {
    return repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
  }

  return `${match[1]}_${match[2]}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

class GitHubService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async cloneRepo(repoUrl: string): Promise<string> {
    const repoName = getRepoCloneName(repoUrl);
    const localPath = path.join(config.clonePath!, repoName);

    if (fs.existsSync(localPath)) {
      console.log(`Repository already exists at ${localPath}. Skipping clone.`);
      return localPath;
    }

    try {
      await this.git.clone(repoUrl, localPath);
      console.log(`Cloned repository to ${localPath}`);
      return localPath;
    } catch (error) {
      console.error('Failed to clone repository:', error);
      throw new ApiError(500, 'Failed to clone repository');
    }
  }

  async scanFiles(localPath: string, shouldStop?: () => boolean): Promise<string[]> {
    const allFiles: string[] = [];
    const walk = (dir: string) => {
      if (shouldStop?.()) {
        return;
      }

      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (shouldStop?.()) {
          return;
        }

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          // Ignore node_modules and .git
          if (file !== 'node_modules' && file !== '.git') {
            walk(filePath);
          }
        } else {
          allFiles.push(filePath);
        }
      }
    };

    walk(localPath);
    return allFiles;
  }

  private extractOwnerRepo(repoUrl: string) {
    const cleanedUrl = repoUrl.replace(/\.git$/, '');
    const match = cleanedUrl.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);

    if (!match) {
      throw new ApiError(400, 'Invalid GitHub repository URL');
    }

    return {
      owner: match[1],
      repo: match[2],
    };
  }

  async fetchRepoMetadata(repoUrl: string): Promise<RepoMetadata | undefined> {
    try {
      const { owner, repo } = this.extractOwnerRepo(repoUrl);
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
      };

      if (config.githubToken) {
        headers.Authorization = `Bearer ${config.githubToken}`;
      }

      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoResponse.ok) {
        console.warn(`Failed to fetch repository metadata for ${repoUrl}: ${repoResponse.status}`);
        return undefined;
      }

      const repoData = await repoResponse.json();

      const languagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
      const languagesData = languagesResponse.ok
        ? ((await languagesResponse.json()) as Record<string, number>)
        : {};

      const sortedLanguages = Object.entries(languagesData)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 5);

      const topics = Array.isArray(repoData.topics) ? (repoData.topics as string[]) : [];
      const primaryLanguage = typeof repoData.language === 'string' ? [repoData.language] : [];
      const techStack = Array.from(new Set([...primaryLanguage, ...sortedLanguages, ...topics])).slice(0, 12);

      return {
        stars: Number(repoData.stargazers_count || 0),
        forks: Number(repoData.forks_count || 0),
        techStack,
      };
    } catch (error) {
      console.warn('Unable to fetch GitHub metadata:', error);
      return undefined;
    }
  }
}

export const githubService = new GitHubService();
