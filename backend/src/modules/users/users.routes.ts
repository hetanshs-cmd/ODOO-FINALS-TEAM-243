import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { usersController } from './users.controller';

// Small internal directory (id/name/role) for approver/assignee display —
// any authenticated internal role can read it, not just admins.
const router = Router();

router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'ADMIN'));
router.get('/', usersController.list);

export { router as usersRouter };
