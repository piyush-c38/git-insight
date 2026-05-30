"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAnalysis = startAnalysis;
exports.getAnalysis = getAnalysis;
exports.chatWithRepo = chatWithRepo;
exports.getFile = getFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../../config"));
const analysis_service_1 = require("../../services/analysis.service");
const rag_service_1 = require("../../services/rag.service");
async function startAnalysis(req, res) {
    const { repoUrl } = req.body;
    if (!repoUrl) {
        return res.status(400).json({ message: 'repoUrl is required' });
    }
    try {
        const analysisId = await analysis_service_1.analysisService.startAnalysis(repoUrl);
        res.status(202).json({ analysisId, status: 'pending' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to start analysis' });
    }
}
async function getAnalysis(req, res) {
    const { analysisId } = req.params;
    const result = analysis_service_1.analysisService.getAnalysisResult(analysisId);
    if (!result) {
        return res.status(404).json({ message: 'Analysis not found' });
    }
    res.json(result);
}
async function chatWithRepo(req, res) {
    const { analysisId } = req.params;
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ message: 'message is required' });
    }
    const analysis = analysis_service_1.analysisService.getAnalysisResult(analysisId);
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
        const reply = await rag_service_1.ragService.getRagResponse(message, analysis.collectionName);
        res.json({ reply });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error during chat' });
    }
}
async function getFile(req, res) {
    const { analysisId } = req.params;
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ message: 'File path query parameter is required' });
    }
    const analysis = analysis_service_1.analysisService.getAnalysisResult(analysisId);
    if (!analysis)
        return res.status(404).json({ message: 'Analysis not found' });
    try {
        const repoUrl = analysis.repoUrl;
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || repoUrl;
        const localPath = path_1.default.join(config_1.default.clonePath, repoName);
        const absolutePath = path_1.default.join(localPath, filePath);
        if (!fs_1.default.existsSync(absolutePath)) {
            return res.status(404).json({ message: 'File not found in cloned repository' });
        }
        const content = fs_1.default.readFileSync(absolutePath, 'utf8');
        res.json({ filePath, content });
    }
    catch (error) {
        console.error('Error reading file from cloned repo:', error);
        res.status(500).json({ message: 'Failed to read file' });
    }
}
