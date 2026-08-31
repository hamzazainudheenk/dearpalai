import { Router } from 'express';
import { ReferralController } from '@controllers/referral.controller';
import {
  authenticateDoctor,
  authenticateProfessional,
  requireDoctor,
  requirePsw,
} from '@middleware/auth.middleware';

const router = Router();
const controller = new ReferralController();

// ─── Doctor Referral Routes ──────────────────────────────────
/** POST /api/referrals — Doctor creates a new patient referral */
router.post('/', authenticateDoctor, requireDoctor, (req, res) =>
  controller.createReferral(req, res)
);

/** GET /api/referrals/patient/:patientId — Doctor views referrals for a specific patient */
router.get('/patient/:patientId', authenticateDoctor, requireDoctor, (req, res) =>
  controller.getPatientReferrals(req, res)
);

// ─── Shared Referral Routes (Strict Server-Side Boundary) ───
/** GET /api/referrals/:id — Retrieve single referral */
router.get('/:id', authenticateProfessional, (req, res) =>
  controller.getReferralById(req, res)
);

/** GET /api/referrals/:id/notes — View referral follow-up notes */
router.get('/:id/notes', authenticateProfessional, (req, res) =>
  controller.getReferralNotes(req, res)
);

// ─── PSW Lifecycle Action Routes ─────────────────────────────
/** POST /api/referrals/:id/accept — PSW accepts a pending referral */
router.post('/:id/accept', authenticateProfessional, requirePsw, (req, res) =>
  controller.acceptReferral(req, res)
);

/** POST /api/referrals/:id/start — PSW starts active follow-up */
router.post('/:id/start', authenticateProfessional, requirePsw, (req, res) =>
  controller.startReferral(req, res)
);

/** POST /api/referrals/:id/complete — PSW completes a referral */
router.post('/:id/complete', authenticateProfessional, requirePsw, (req, res) =>
  controller.completeReferral(req, res)
);

/** POST /api/referrals/:id/notes — PSW logs a follow-up note */
router.post('/:id/notes', authenticateProfessional, requirePsw, (req, res) =>
  controller.createReferralNote(req, res)
);

export default router;
