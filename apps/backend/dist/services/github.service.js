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
}
exports.githubService = new GitHubService();
