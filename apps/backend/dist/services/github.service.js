"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubService = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config"));
const errors_1 = require("../lib/errors");
class GitHubService {
    constructor() {
        this.git = (0, simple_git_1.default)();
    }
    async cloneRepo(repoUrl) {
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
        const localPath = path_1.default.join(config_1.default.clonePath, repoName);
        if (fs_1.default.existsSync(localPath)) {
            console.log(`Repository already exists at ${localPath}. Skipping clone.`);
            return localPath;
        }
        try {
            await this.git.clone(repoUrl, localPath);
            console.log(`Cloned repository to ${localPath}`);
            return localPath;
        }
        catch (error) {
            console.error('Failed to clone repository:', error);
            throw new errors_1.ApiError(500, 'Failed to clone repository');
        }
    }
    async scanFiles(localPath) {
        const allFiles = [];
        const walk = (dir) => {
            const files = fs_1.default.readdirSync(dir);
            for (const file of files) {
                const filePath = path_1.default.join(dir, file);
                const stat = fs_1.default.statSync(filePath);
                if (stat.isDirectory()) {
                    // Ignore node_modules and .git
                    if (file !== 'node_modules' && file !== '.git') {
                        walk(filePath);
                    }
                }
                else {
                    allFiles.push(filePath);
                }
            }
        };
        walk(localPath);
        return allFiles;
    }
    extractOwnerRepo(repoUrl) {
        const cleanedUrl = repoUrl.replace(/\.git$/, '');
        const match = cleanedUrl.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);
        if (!match) {
            throw new errors_1.ApiError(400, 'Invalid GitHub repository URL');
        }
        return {
            owner: match[1],
            repo: match[2],
        };
    }
    async fetchRepoMetadata(repoUrl) {
        try {
            const { owner, repo } = this.extractOwnerRepo(repoUrl);
            const headers = {
                Accept: 'application/vnd.github+json',
            };
            if (config_1.default.githubToken) {
                headers.Authorization = `Bearer ${config_1.default.githubToken}`;
            }
            const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
            if (!repoResponse.ok) {
                console.warn(`Failed to fetch repository metadata for ${repoUrl}: ${repoResponse.status}`);
                return undefined;
            }
            const repoData = await repoResponse.json();
            const languagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
            const languagesData = languagesResponse.ok
                ? (await languagesResponse.json())
                : {};
            const sortedLanguages = Object.entries(languagesData)
                .sort((a, b) => b[1] - a[1])
                .map(([name]) => name)
                .slice(0, 5);
            const topics = Array.isArray(repoData.topics) ? repoData.topics : [];
            const primaryLanguage = typeof repoData.language === 'string' ? [repoData.language] : [];
            const techStack = Array.from(new Set([...primaryLanguage, ...sortedLanguages, ...topics])).slice(0, 12);
            return {
                stars: Number(repoData.stargazers_count || 0),
                forks: Number(repoData.forks_count || 0),
                techStack,
            };
        }
        catch (error) {
            console.warn('Unable to fetch GitHub metadata:', error);
            return undefined;
        }
    }
}
exports.githubService = new GitHubService();
