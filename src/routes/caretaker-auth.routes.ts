import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CaretakerAuthController } from '@controllers/caretaker-auth.controller';
import { CaretakerAuthService } from '@services/caretaker-auth.service';
import { OtpService } from '@services/otp/otp.service';
import { createOtpProvider } from '@services/otp/otp-provider';
import { authenticateCaretaker } from '@middleware/auth.middleware';

const router = Router();
const controller = new CaretakerAuthController(
  new CaretakerAuthService(new OtpService(createOtpProvider())),
);

/** Tighter than the app-wide limiter, and tighter still on `/link` — a
 *  caretaker code is the one thing here worth brute-forcing. */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});

const linkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});

router.post('/otp/send', otpLimiter, controller.sendOtp);
router.post('/otp/verify', otpLimiter, controller.verifyOtp);
router.post('/link', linkLimiter, authenticateCaretaker, controller.link);
router.get('/me', authenticateCaretaker, controller.me);

export default router;
