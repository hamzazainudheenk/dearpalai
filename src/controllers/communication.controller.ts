import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { CommunicationService, CommunicationUser } from '../services/communication.service';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export class CommunicationController {
  private service: CommunicationService;

  constructor(service?: CommunicationService) {
    this.service = service || new CommunicationService();
  }

  private extractUser(req: AuthenticatedRequest): CommunicationUser {
    if (req.doctor) {
      return {
        id: req.doctor.id,
        role: req.doctor.role,
        name: req.doctor.fullName || (req.doctor.role === 'psw' ? 'PSW' : 'Doctor'),
        email: req.doctor.email,
      };
    }

    if (req.chatIdentity) {
      return {
        id: req.chatIdentity.type === 'patient' ? req.chatIdentity.patientId : req.chatIdentity.caretakerId,
        role: req.chatIdentity.type,
        name: req.chatIdentity.type === 'patient' ? 'Patient' : 'Caretaker',
        patientId: req.chatIdentity.type === 'patient' ? req.chatIdentity.patientId : req.chatIdentity.linkedPatientId || undefined,
        caretakerId: req.chatIdentity.type === 'caretaker' ? req.chatIdentity.caretakerId : undefined,
      };
    }

    throw new AppError('Unauthorized: Missing authenticated professional or care identity', 401, true, 'UNAUTHORIZED');
  }

  /**
   * GET /api/communications/threads
   */
  async getThreads(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = this.extractUser(req);
      const roleFilter = req.query.roleFilter as 'all' | 'patients' | 'caretakers' | undefined;
      const unreadOnly = req.query.unreadOnly === 'true';
      const search = (req.query.search as string) || '';
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '50', 10);

      const threads = await this.service.getThreads(user, {
        roleFilter,
        unreadOnly,
        search,
        page,
        limit,
      });

      res.status(200).json({
        status: 'success',
        data: threads,
      });
    } catch (err) {
      this.handleError(err, res, 'getThreads');
    }
  }

  /**
   * POST /api/communications/threads
   */
  async createThread(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = this.extractUser(req);
      const { patientId, threadType, targetProfessionalId } = req.body;

      const thread = await this.service.getOrCreateThread(user, {
        patientId,
        threadType,
        targetProfessionalId,
      });

      res.status(201).json({
        status: 'success',
        data: thread,
      });
    } catch (err) {
      this.handleError(err, res, 'createThread');
    }
  }

  /**
   * GET /api/communications/threads/:threadId
   */
  async getThreadById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = this.extractUser(req);
      const threadId = req.params.threadId as string;

      const thread = await this.service.getThreadById(user, threadId);

      res.status(200).json({
        status: 'success',
        data: thread,
      });
    } catch (err) {
      this.handleError(err, res, 'getThreadById');
    }
  }

  /**
   * GET /api/communications/threads/:threadId/messages
   */
  async getThreadMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = this.extractUser(req);
      const threadId = req.params.threadId as string;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '100', 10);

      const result = await this.service.getThreadMessages(user, threadId, page, limit);

      res.status(200).json({
        status: 'success',
        data: result.messages,
        total: result.total,
      });
    } catch (err) {
      this.handleError(err, res, 'getThreadMessages');
    }
  }

  /**
   * POST /api/communications/threads/:threadId/messages
   */
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = this.extractUser(req);
      const threadId = req.params.threadId as string;
      const { content } = req.body;

      const message = await this.service.sendMessage(user, threadId, content);

      res.status(201).json({
        status: 'success',
        data: message,
      });
    } catch (err) {
      this.handleError(err, res, 'sendMessage');
    }
  }

  /**
   * POST /api/communications/threads/:threadId/read
   */
  async markThreadRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = this.extractUser(req);
      const threadId = req.params.threadId as string;

      await this.service.markThreadRead(user, threadId);

      res.status(200).json({
        status: 'success',
        message: 'Thread marked as read',
      });
    } catch (err) {
      this.handleError(err, res, 'markThreadRead');
    }
  }

  private handleError(err: unknown, res: Response, action: string): void {
    if (err instanceof AppError) {
      logger.warn(`Communication error in ${action}`, {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      });
      res.status(err.statusCode).json({
        status: 'error',
        code: err.code,
        message: err.message,
      });
      return;
    }

    const message = (err as Error)?.message || 'Internal server error';
    logger.error(`Unhandled communication error in ${action}`, { error: message });
    res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred during communication operation',
    });
  }
}
