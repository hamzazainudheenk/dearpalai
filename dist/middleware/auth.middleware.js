"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateDoctor = authenticateDoctor;
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
        req.doctor = {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || '',
        };
        next();
    }
    catch (err) {
        logger_1.logger.error('Unexpected error in auth middleware', { error: err.message });
        res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
    }
}
//# sourceMappingURL=auth.middleware.js.map