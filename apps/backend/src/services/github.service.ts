import fs from 'fs';
import path from 'path';
import config from '../config';
import { ApiError } from '../lib/errors';
import { shouldSkipDirectory } from '../lib/embeddable-files';
import { isLockFile } from '../lib/manifest-files';
import {
  buildArchiveUrl,
  downloadAndExtractGitHubArchive,
  fetchDefaultBranch,
  parseGitHubRepoUrl,
} from '../lib/github-archive';
import { yieldToEventLoop } from '../lib/async-utils';

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
  private githubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-github-explainer',
    };

    if (config.githubToken) {
      headers.Authorization = `Bearer ${config.githubToken}`;
    }

    return headers;
  }

  async cloneRepo(repoUrl: string): Promise<string> {
    const repoName = getRepoCloneName(repoUrl);
    const localPath = path.join(config.clonePath!, repoName);

    if (fs.existsSync(localPath)) {
      console.log(`[perf] Repository already exists at ${localPath}. Skipping download.`);
      return localPath;
    }

    const { owner, repo } = parseGitHubRepoUrl(repoUrl);
    const headers = this.githubHeaders();

    try {
      console.time('Repository Download');
      const defaultBranch = await fetchDefaultBranch(owner, repo, headers);
      const branches = [defaultBranch, 'main', 'master'].filter(
        (branch): branch is string => Boolean(branch)
      );

      console.log(`[repo] acquiring ${owner}/${repo} via GitHub archive (branches: ${branches.join(', ')})`);

      const result = await downloadAndExtractGitHubArchive({
        owner,
        repo,
        branches,
        destinationPath: localPath,
        headers,
      });

      console.log(`[perf] Repository archive downloaded from ${result.archiveUrl}`);
      console.log(`[perf] Stored repository at ${localPath}`);
      console.timeEnd('Repository Download');
      return localPath;
    } catch (error) {
      console.timeEnd('Repository Download');
      console.error('Failed to download repository archive:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to download repository');
    }
  }

  async scanFiles(localPath: string, shouldStop?: () => boolean): Promise<string[]> {
    const allFiles: string[] = [];
    const queue: string[] = [localPath];
    let scannedDirs = 0;

    while (queue.length > 0) {
      if (shouldStop?.()) {
        break;
      }

      const dir = queue.shift();
      if (!dir) continue;

      const entries = fs.readdirSync(dir);
      for (const file of entries) {
        if (shouldStop?.()) {
          return allFiles;
        }

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (!shouldSkipDirectory(file)) {
            queue.push(filePath);
          }
        } else if (!isLockFile(file)) {
          allFiles.push(filePath);
        }
      }

      scannedDirs += 1;
      if (scannedDirs % 25 === 0) {
        await yieldToEventLoop();
      }
    }

    console.log(`[perf] File discovery found ${allFiles.length} files under ${localPath}`);
    return allFiles;
  }

  private extractOwnerRepo(repoUrl: string) {
    return parseGitHubRepoUrl(repoUrl);
  }

  async fetchRepoMetadata(repoUrl: string): Promise<RepoMetadata | undefined> {
    try {
      const { owner, repo } = this.extractOwnerRepo(repoUrl);
      const headers = this.githubHeaders();

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

// Exported for tests/diagnostics
export { buildArchiveUrl };
