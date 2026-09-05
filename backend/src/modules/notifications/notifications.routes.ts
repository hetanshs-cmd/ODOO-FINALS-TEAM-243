import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { notificationsController } from './notifications.controller';
import { idParamSchema, listNotificationsQuerySchema } from './notifications.validator';

const router = Router();

router.use(authenticate);
router.get('/', validate({ query: listNotificationsQuerySchema }), notificationsController.list);
router.post('/:id/read', validate({ params: idParamSchema }), notificationsController.markRead);

export { router as notificationsRouter };
