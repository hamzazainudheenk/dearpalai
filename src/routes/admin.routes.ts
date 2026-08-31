import { Router } from 'express';
import { AdminController } from '@controllers/admin.controller';
import { authenticateDoctor, requireAdmin } from '@middleware/auth.middleware';

const router = Router();
const controller = new AdminController();

// Enforce authentication and strict Admin role requirement on all admin routes
router.use(authenticateDoctor);
router.use(requireAdmin);

/** GET /api/admin/dashboard — Real system dashboard metrics */
router.get('/dashboard', (req, res) => controller.getDashboardStats(req, res));

/** GET /api/admin/professionals — List professionals */
router.get('/professionals', (req, res) => controller.getProfessionals(req, res));

/** POST /api/admin/professionals — Admin creates Doctor or PSW account */
router.post('/professionals', (req, res) => controller.createProfessional(req, res));

/** GET /api/admin/professionals/:id — Get professional profile */
router.get('/professionals/:id', (req, res) => controller.getProfessionalById(req, res));

/** PATCH /api/admin/professionals/:id — Update professional profile */
router.patch('/professionals/:id', (req, res) => controller.updateProfessional(req, res));

/** POST /api/admin/professionals/:id/activate — Activate professional */
router.post('/professionals/:id/activate', (req, res) => controller.activateProfessional(req, res));

/** POST /api/admin/professionals/:id/deactivate — Deactivate professional */
router.post('/professionals/:id/deactivate', (req, res) => controller.deactivateProfessional(req, res));

/** POST /api/admin/professionals/:id/reset-password — Reset professional password */
router.post('/professionals/:id/reset-password', (req, res) => controller.resetPassword(req, res));

export default router;
