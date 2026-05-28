"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errors_1 = require("../lib/errors");
const analysis_service_1 = require("../services/analysis.service");
const rag_service_1 = require("../services/rag.service");
const router = (0, express_1.Router)();
router.post('/repo', (0, errors_1.handleErrors)(async (req, res) => {
    const { url } = req.body;
    if (!url) {
        throw new errors_1.ApiError(400, 'Repository URL is required');
    }
    const result = await analysis_service_1.analysisService.analyzeRepo(url);
    res.json(result);
}));
router.post('/chat', (0, errors_1.handleErrors)(async (req, res) => {
    const { query, collectionName } = req.body;
    if (!query || !collectionName) {
        throw new errors_1.ApiError(400, 'Query and collectionName are required');
    }
    const reply = await rag_service_1.ragService.getRagResponse(query, collectionName);
    res.json({ reply });
}));
exports.default = router;
