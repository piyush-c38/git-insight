import { Router } from 'express';
import * as RepoController from '../controllers/repoController';

const router = Router();

// Health check route
router.get('/health', (req, res) => res.status(200).send('OK'));

router.post('/analyze', RepoController.startAnalysis);
router.get('/:analysisId/status', RepoController.getAnalysisStatus);
router.get('/:analysisId', RepoController.getAnalysis);
router.post('/:analysisId/cancel', RepoController.cancelAnalysis);
router.get('/:analysisId/file', RepoController.getFile);
router.post('/:analysisId/chat', RepoController.chatWithRepo);

export default router;