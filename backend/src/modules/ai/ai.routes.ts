import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { aiController } from './ai.controller';
import { insightRequestSchema, chatRequestSchema } from './ai.validator';

// Mounted at /api/v1/ai. Real-model-backed replacement for the frontend's
// deterministic contextualAIAdapter templates (docs/api.md documents both
// routes). Every internal role can use it — role-scoping of the underlying
// data happens inside aiService via the same per-module services the
// regular REST routes use.
const router = Router();

router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN', 'FINANCE'));

router.post('/insight', validate({ body: insightRequestSchema }), aiController.getInsight);
router.post('/chat', validate({ body: chatRequestSchema }), aiController.chat);

export { router as aiRouter };
