import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';

export interface AuthenticatedRequest extends Request {
  doctor?: {
    id: string;
    email: string;
    fullName?: string;
    role: 'doctor' | 'admin';
  };
}

export async function authenticateDoctor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Authentication failed for request', { error: error?.message });
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    // Retrieve doctor profile to get role
    let role: 'doctor' | 'admin' = 'doctor';
    try {
      const { data: doctorProfile } = await supabaseAdmin
        .from('doctors')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (doctorProfile?.role === 'admin') {
        role = 'admin';
      } else if (user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin') {
        role = 'admin';
      }
    } catch (dbErr) {
      logger.warn('Failed to fetch doctor role, defaulting to doctor', { error: (dbErr as Error).message });
    }

    req.doctor = {
      id: user.id,
      email: user.email || '',
      fullName: user.user_metadata?.full_name || '',
      role,
    };

    next();
  } catch (err) {
    logger.error('Unexpected error in auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}

/**
 * Authorization Middleware: Ensures only users with role = 'admin' can proceed.
 * Returns 403 Forbidden if user is not an admin.
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.doctor || req.doctor.role !== 'admin') {
    logger.warn('Non-admin user attempted to access admin endpoint', {
      userId: req.doctor?.id,
      email: req.doctor?.email,
      role: req.doctor?.role,
    });
    res.status(403).json({
      status: 'error',
      message: 'Forbidden: Admin access required',
    });
    return;
  }
  next();
}
