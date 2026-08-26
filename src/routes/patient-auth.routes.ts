import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PatientAuthController } from '@controllers/patient-auth.controller';
import { PatientAuthService } from '@services/patient-auth.service';
import { authenticatePatient } from '@middleware/auth.middleware';

const router = Router();
const controller = new PatientAuthController(new PatientAuthService());

/** Tighter than the app-wide limiter — signup/login are higher-value
 *  targets for abuse than ordinary reads. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});

router.post('/signup', authLimiter, controller.signup);
router.post('/login', authLimiter, controller.login);
router.post('/login/verify', authLimiter, controller.verifyLogin);
router.get('/profile', authenticatePatient, controller.getProfile);
router.get('/caretaker-code', authenticatePatient, controller.getCaretakerCode);
router.post('/caretaker-code/refresh', authenticatePatient, authLimiter, controller.refreshCaretakerCode);

export default router;
