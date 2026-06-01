import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { ApiError } from './errors';

export type GitHubRepoRef = {
  owner: string;
  repo: string;
};

export function parseGitHubRepoUrl(repoUrl: string): GitHubRepoRef {
  const cleanedUrl = repoUrl.replace(/\.git$/, '').trim();
  const match = cleanedUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\/.*)?$/i);

  if (!match) {
    throw new ApiError(400, 'Invalid GitHub repository URL');
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

export function buildArchiveUrl(owner: string, repo: string, branch: string): string {
  return `https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(branch)}.zip`;
}

export async function fetchDefaultBranch(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<string | undefined> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!response.ok) return undefined;

  const data = (await response.json()) as { default_branch?: string };
  return typeof data.default_branch === 'string' ? data.default_branch : undefined;
}

function uniqueBranches(branches: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const branch of branches) {
    const key = branch.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function moveDirectoryContents(sourceDir: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    const from = path.join(sourceDir, entry);
    const to = path.join(targetDir, entry);
    if (fs.existsSync(to)) {
      fs.rmSync(to, { recursive: true, force: true });
    }
    fs.renameSync(from, to);
  }
}

export async function downloadAndExtractGitHubArchive(options: {
  owner: string;
  repo: string;
  branches: string[];
  destinationPath: string;
  headers?: Record<string, string>;
}): Promise<{ branch: string; archiveUrl: string; downloadBytes: number }> {
  const { owner, repo, destinationPath, headers = {} } = options;
  const branches = uniqueBranches(options.branches);

  if (branches.length === 0) {
    throw new ApiError(400, 'No branch specified for archive download');
  }

  let lastError: Error | null = null;

  for (const branch of branches) {
    const archiveUrl = buildArchiveUrl(owner, repo, branch);
    console.log('[repo] archive URL:', archiveUrl);

    try {
      const response = await fetch(archiveUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'git-insight',
          ...headers,
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        const message = `Archive download failed for branch "${branch}" (${response.status})`;
        console.warn(`[repo] ${message}`);
        lastError = new ApiError(response.status === 404 ? 404 : 502, message);
        if (response.status === 404) continue;
        throw lastError;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const downloadBytes = buffer.length;
      const downloadMb = (downloadBytes / (1024 * 1024)).toFixed(2);
      console.log(`[repo] download size: ${downloadBytes} bytes (${downloadMb} MB)`);

      const parentDir = path.dirname(destinationPath);
      fs.mkdirSync(parentDir, { recursive: true });

      const extractTempDir = path.join(parentDir, `.extract_${path.basename(destinationPath)}_${Date.now()}`);
      fs.mkdirSync(extractTempDir, { recursive: true });

      const zip = new AdmZip(buffer);
      zip.extractAllTo(extractTempDir, true);

      const topLevelEntries = fs.readdirSync(extractTempDir).filter((name) => {
        const entryPath = path.join(extractTempDir, name);
        return fs.statSync(entryPath).isDirectory();
      });

      if (topLevelEntries.length === 0) {
        throw new ApiError(500, 'Archive extraction produced no root directory');
      }

      const archiveRoot = path.join(extractTempDir, topLevelEntries[0]);
      if (fs.existsSync(destinationPath)) {
        fs.rmSync(destinationPath, { recursive: true, force: true });
      }
      fs.mkdirSync(destinationPath, { recursive: true });
      moveDirectoryContents(archiveRoot, destinationPath);
      fs.rmSync(extractTempDir, { recursive: true, force: true });

      console.log('[repo] extraction path:', destinationPath);
      console.log(`[repo] extracted branch: ${branch}`);

      return { branch, archiveUrl, downloadBytes };
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new ApiError(404, 'Repository archive not found for main or master branch');
}
