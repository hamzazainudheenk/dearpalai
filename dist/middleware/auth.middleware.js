"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateDoctor = authenticateDoctor;
exports.requireAdmin = requireAdmin;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
async function authenticateDoctor(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            logger_1.logger.warn('Authentication failed for request', { error: error?.message });
            res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
            return;
        }
        // Retrieve doctor profile to get role
        let role = 'doctor';
        try {
            const { data: doctorProfile } = await supabase_1.supabaseAdmin
                .from('doctors')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (doctorProfile?.role === 'admin') {
                role = 'admin';
            }
            else if (user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin') {
                role = 'admin';
            }
        }
        catch (dbErr) {
            logger_1.logger.warn('Failed to fetch doctor role, defaulting to doctor', { error: dbErr.message });
        }
        req.doctor = {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || '',
            role,
        };
        next();
    }
    catch (err) {
        logger_1.logger.error('Unexpected error in auth middleware', { error: err.message });
        res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
    }
}
/**
 * Authorization Middleware: Ensures only users with role = 'admin' can proceed.
 * Returns 403 Forbidden if user is not an admin.
 */
async function requireAdmin(req, res, next) {
    if (!req.doctor || req.doctor.role !== 'admin') {
        logger_1.logger.warn('Non-admin user attempted to access admin endpoint', {
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
//# sourceMappingURL=auth.middleware.js.map