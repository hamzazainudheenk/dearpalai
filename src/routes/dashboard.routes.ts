import { Router } from 'express';
import { DashboardController } from '@controllers/dashboard.controller';
import { authenticateDoctor } from '@middleware/auth.middleware';

const router = Router();
const controller = new DashboardController();

router.use(authenticateDoctor);

router.get('/stats', (req, res) => controller.getStats(req, res));

export default router;
