import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { ReferralService } from '@services/referral.service';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export class ReferralController {
  constructor(private readonly referralService: ReferralService = new ReferralService()) {}

  /**
   * POST /api/referrals
   * Doctor creates a new patient referral.
   */
  async createReferral(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const doctorId = req.professional?.id;
      if (!doctorId || req.professional?.role !== 'doctor' && req.professional?.role !== 'admin') {
        res.status(403).json({ status: 'error', message: 'Forbidden: Doctor access required' });
        return;
      }

      const { patientId, pswId, reason, selectedContext, instructions } = req.body;
      const referral = await this.referralService.createReferral(doctorId, {
        patientId,
        pswId,
        reason,
        selectedContext,
        instructions,
      });

      res.status(201).json({ status: 'success', data: referral });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in createReferral controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/referrals/patient/:patientId
   * Doctor views all referrals for a given patient under their care.
   */
  async getPatientReferrals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const doctorId = req.professional?.id;
      const patientId = String(req.params.patientId);

      if (!doctorId || (req.professional?.role !== 'doctor' && req.professional?.role !== 'admin')) {
        res.status(403).json({ status: 'error', message: 'Forbidden: Doctor access required' });
        return;
      }

      const referrals = await this.referralService.getPatientReferrals(doctorId, patientId);
      res.status(200).json({ status: 'success', data: referrals });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getPatientReferrals controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/psw/referrals
   * PSW retrieves their follow-up queue.
   */
  async getPswReferrals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pswId = req.professional?.id;
      if (!pswId || (req.professional?.role !== 'psw' && req.professional?.role !== 'admin')) {
        res.status(403).json({ status: 'error', message: 'Forbidden: PSW access required' });
        return;
      }

      const statusFilter = req.query.status as string | undefined;
      const referrals = await this.referralService.getPswReferrals(pswId, statusFilter);
      res.status(200).json({ status: 'success', data: referrals });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getPswReferrals controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/referrals/:id
   * Retrieves single referral details with role boundary enforcement.
   */
  async getReferralById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const professionalId = req.professional?.id;
      const role = req.professional?.role;
      const id = String(req.params.id);

      if (!professionalId || !role) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const referral = await this.referralService.getReferralById(professionalId, role, id);
      res.status(200).json({ status: 'success', data: referral });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getReferralById controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/referrals/:id/accept
   * PSW accepts a pending referral.
   */
  async acceptReferral(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pswId = req.professional?.id;
      const id = String(req.params.id);

      if (!pswId || (req.professional?.role !== 'psw' && req.professional?.role !== 'admin')) {
        res.status(403).json({ status: 'error', message: 'Forbidden: PSW access required' });
        return;
      }

      const updated = await this.referralService.acceptReferral(pswId, id);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in acceptReferral controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/referrals/:id/start
   * PSW starts active follow-up on an accepted referral.
   */
  async startReferral(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pswId = req.professional?.id;
      const id = String(req.params.id);

      if (!pswId || (req.professional?.role !== 'psw' && req.professional?.role !== 'admin')) {
        res.status(403).json({ status: 'error', message: 'Forbidden: PSW access required' });
        return;
      }

      const updated = await this.referralService.startReferral(pswId, id);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in startReferral controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/referrals/:id/complete
   * PSW completes a referral.
   */
  async completeReferral(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pswId = req.professional?.id;
      const id = String(req.params.id);

      if (!pswId || (req.professional?.role !== 'psw' && req.professional?.role !== 'admin')) {
        res.status(403).json({ status: 'error', message: 'Forbidden: PSW access required' });
        return;
      }

      const updated = await this.referralService.completeReferral(pswId, id);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in completeReferral controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/referrals/:id/notes
   * Doctor or PSW views follow-up notes for an authorized referral.
   */
  async getReferralNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const professionalId = req.professional?.id;
      const role = req.professional?.role;
      const id = String(req.params.id);

      if (!professionalId || !role) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const notes = await this.referralService.getReferralNotes(professionalId, role, id);
      res.status(200).json({ status: 'success', data: notes });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getReferralNotes controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/referrals/:id/notes
   * Assigned PSW records a follow-up note.
   */
  async createReferralNote(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pswId = req.professional?.id;
      const id = String(req.params.id);
      const { note, noteType } = req.body;

      if (!pswId || (req.professional?.role !== 'psw' && req.professional?.role !== 'admin')) {
        res.status(403).json({ status: 'error', message: 'Forbidden: PSW access required' });
        return;
      }

      const newNote = await this.referralService.createReferralNote(pswId, id, { note, noteType });
      res.status(201).json({ status: 'success', data: newNote });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in createReferralNote controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/psw/available-counsellors
   * Doctor views available registered PSWs to direct a referral.
   */
  async getAvailablePsws(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const psws = await this.referralService.getAvailablePsws();
      res.status(200).json({ status: 'success', data: psws });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getAvailablePsws controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }
}
