import { Router } from 'express';
import { SessionController } from '@controllers/session.controller';
import { authenticateDoctor } from '@middleware/auth.middleware';

const router = Router({ mergeParams: true });
const controller = new SessionController();

router.use(authenticateDoctor);

router.post('/', (req, res) => controller.createSession(req, res));
router.get('/', (req, res) => controller.getSessions(req, res));

export default router;
