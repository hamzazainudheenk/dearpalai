import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';

export interface AuthenticatedRequest extends Request {
  doctor?: {
    id: string;
    email: string;
    fullName?: string;
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

    req.doctor = {
      id: user.id,
      email: user.email || '',
      fullName: user.user_metadata?.full_name || '',
    };

    next();
  } catch (err) {
    logger.error('Unexpected error in auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}
