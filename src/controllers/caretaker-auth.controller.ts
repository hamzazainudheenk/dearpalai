import { Request, Response } from 'express';
import { CaretakerAuthService } from '@services/caretaker-auth.service';
import { AuthenticatedCaretakerRequest } from '@middleware/auth.middleware';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export class CaretakerAuthController {
  constructor(private readonly caretakerAuthService: CaretakerAuthService) {}

  /**
   * POST /api/caretaker/otp/send
   * `devOtp` is present in the response ONLY when OTP_PROVIDER=mock and
   * NODE_ENV != production — see `services/otp/otp-provider.ts`.
   */
  sendOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { mobile } = req.body || {};
      const result = await this.caretakerAuthService.sendOtp(mobile);
      res.status(200).json({
        status: 'success',
        message: 'A verification code has been sent.',
        ...(result.devOtp && { devOtp: result.devOtp }),
      });
    } catch (err) {
      this.handleError(err, res, 'sendOtp');
    }
  };

  /**
   * POST /api/caretaker/otp/verify
   * Returns a real Supabase session for the caretaker identity.
   */
  verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { mobile, otp } = req.body || {};
      const result = await this.caretakerAuthService.verifyOtpAndAuthenticate(mobile, otp);
      res.status(200).json({
        status: 'success',
        data: { accessToken: result.accessToken, refreshToken: result.refreshToken },
      });
    } catch (err) {
      this.handleError(err, res, 'verifyOtp');
    }
  };

  /**
   * POST /api/caretaker/link
   * Authenticated caretaker only.
   */
  link = async (req: AuthenticatedCaretakerRequest, res: Response): Promise<void> => {
    try {
      if (!req.caretaker) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Unauthorized' });
        return;
      }
      const { caretakerCode } = req.body || {};
      const result = await this.caretakerAuthService.linkWithCode(req.caretaker.id, caretakerCode);
      res.status(200).json({ status: 'success', data: { status: 'linked', patient: result.patient } });
    } catch (err) {
      this.handleError(err, res, 'link');
    }
  };

  /**
   * GET /api/caretaker/me
   * Authenticated caretaker only. Returns their active link, if any —
   * never anything about a patient they aren't linked to.
   */
  me = async (req: AuthenticatedCaretakerRequest, res: Response): Promise<void> => {
    try {
      if (!req.caretaker) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Unauthorized' });
        return;
      }
      const result = await this.caretakerAuthService.getActiveLink(req.caretaker.id);
      res.status(200).json({ status: 'success', data: { patient: result.patient } });
    } catch (err) {
      this.handleError(err, res, 'me');
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
    logger.error(`Unhandled error in CaretakerAuthController.${action}`, {
      error: (err as Error).message,
    });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
