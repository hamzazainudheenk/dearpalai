import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { AdminService } from '@services/admin.service';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export class AdminController {
  constructor(private readonly adminService: AdminService = new AdminService()) {}

  /**
   * GET /api/admin/dashboard
   * Real system stats for Admin dashboard
   */
  async getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await this.adminService.getDashboardStats();
      res.status(200).json({ status: 'success', data: stats });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getDashboardStats controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/professionals
   * List professionals with filtering and pagination
   */
  async getProfessionals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

      const result = await this.adminService.getProfessionals({
        role,
        status,
        search,
        page,
        limit,
      });

      res.status(200).json({
        status: 'success',
        data: result.professionals,
        meta: result.meta,
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getProfessionals controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/professionals/:id
   * Get single professional details
   */
  async getProfessionalById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const professional = await this.adminService.getProfessionalById(id);
      res.status(200).json({ status: 'success', data: professional });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in getProfessionalById controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/professionals
   * Admin creates a new Doctor or PSW account
   */
  async createProfessional(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.professional?.id || 'admin';
      const { role, fullName, employeeId, posting, clinicName, email, initialPassword, isActive } = req.body;

      const created = await this.adminService.createProfessional(adminId, {
        role,
        fullName,
        employeeId,
        posting,
        clinicName,
        email,
        initialPassword,
        isActive,
      });

      res.status(201).json({ status: 'success', data: created });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in createProfessional controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * PATCH /api/admin/professionals/:id
   * Edit professional profile
   */
  async updateProfessional(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { fullName, employeeId, posting, clinicName, email, isActive } = req.body;

      const updated = await this.adminService.updateProfessional(id, {
        fullName,
        employeeId,
        posting,
        clinicName,
        email,
        isActive,
      });

      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in updateProfessional controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/professionals/:id/activate
   */
  async activateProfessional(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await this.adminService.setProfessionalStatus(id, true);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in activateProfessional controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/professionals/:id/deactivate
   */
  async deactivateProfessional(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await this.adminService.setProfessionalStatus(id, false);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in deactivateProfessional controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/professionals/:id/reset-password
   */
  async resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { newPassword } = req.body;

      const result = await this.adminService.resetProfessionalPassword(id, newPassword);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ status: 'error', code: err.code, message: err.message });
        return;
      }
      logger.error('Error in resetPassword controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }
}
