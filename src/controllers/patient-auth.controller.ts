import { Request, Response } from 'express';
import { PatientAuthService } from '@services/patient-auth.service';
import { AuthenticatedPatientRequest } from '@middleware/auth.middleware';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  /**
   * POST /api/patient/signup
   * Creates a patient account. Returns the caretaker code in plaintext —
   * the ONE time it is ever returned by this API.
   */
  signup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fullName, mobile, email, clinic } = req.body || {};
      const result = await this.patientAuthService.signup({ fullName, mobile, email, clinic });
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      this.handleError(err, res, 'signup');
    }
  };

  /**
   * POST /api/patient/login
   * Starts passwordless email-OTP login. Always returns 200 with a generic
   * message, whether or not the email is registered.
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body || {};
      await this.patientAuthService.login(email);
      res.status(200).json({
        status: 'success',
        message: 'If an account exists for this email, a login code has been sent.',
      });
    } catch (err) {
      this.handleError(err, res, 'login');
    }
  };

  /**
   * POST /api/patient/login/verify
   * Verifies the email OTP and returns a real Supabase session.
   */
  verifyLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, token } = req.body || {};
      const result = await this.patientAuthService.verifyLogin(email, token);
      res.status(200).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          patient: result.patient,
        },
      });
    } catch (err) {
      this.handleError(err, res, 'verifyLogin');
    }
  };

  /**
   * GET /api/patient/profile
   * Authenticated patient only. Never returns the caretaker code, clinical
   * data, or doctor-internal fields — see `PatientAuthService.getProfile*`.
   */
  getProfile = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      if (!req.patient) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Unauthorized' });
        return;
      }
      res.status(200).json({ status: 'success', data: req.patient });
    } catch (err) {
      this.handleError(err, res, 'getProfile');
    }
  };

  /**
   * GET /api/patient/caretaker-code
   * Authenticated patient only. Derives patient identity exclusively from req.patient.
   */
  getCaretakerCode = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      if (!req.patient) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Unauthorized' });
        return;
      }
      const data = await this.patientAuthService.getActiveCaretakerCode(req.patient.dearPalId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      this.handleError(err, res, 'getCaretakerCode');
    }
  };

  /**
   * POST /api/patient/caretaker-code/refresh
   * Authenticated patient only. Generates a new code and revokes prior unlinked codes.
   */
  refreshCaretakerCode = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      if (!req.patient) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Unauthorized' });
        return;
      }
      const data = await this.patientAuthService.refreshCaretakerCode(req.patient.dearPalId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      this.handleError(err, res, 'refreshCaretakerCode');
    }
  };

  private handleError(err: unknown, res: Response, action: string): void {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        status: 'error',
        ...(err.code && { code: err.code }),
        message: err.message,
      });
      return;
    }
    logger.error(`Unhandled error in PatientAuthController.${action}`, {
      error: (err as Error).message,
    });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
