import { Router } from 'express';
import { ReferralController } from '@controllers/referral.controller';
import {
  authenticateDoctor,
  authenticateProfessional,
  requirePsw,
} from '@middleware/auth.middleware';

const router = Router();
const controller = new ReferralController();

/** GET /api/psw/referrals — PSW views their referral queue */
router.get('/referrals', authenticateProfessional, requirePsw, (req, res) =>
  controller.getPswReferrals(req, res)
);

/** GET /api/psw/available-counsellors — Doctor/Admin views list of available PSW counsellors */
router.get('/available-counsellors', authenticateDoctor, (req, res) =>
  controller.getAvailablePsws(req, res)
);

export default router;
