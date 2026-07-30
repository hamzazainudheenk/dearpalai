"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
class DashboardController {
    /**
     * GET /api/dashboard/stats
     * Aggregates stats, alerts, and activity for the doctor's dashboard.
     */
    async getStats(req, res) {
        try {
            const doctorId = req.doctor?.id;
            if (!doctorId) {
                res.status(401).json({ status: 'error', message: 'Unauthorized' });
                return;
            }
            // 1. Total patients count
            const { count: totalPatients } = await supabase_1.supabaseAdmin
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', doctorId);
            // 2. Today's sessions count
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { count: todaySessions } = await supabase_1.supabaseAdmin
                .from('sessions')
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', doctorId)
                .gte('created_at', startOfDay.toISOString());
            // 3. High risk patients for alerts
            const { data: highRiskPatients } = await supabase_1.supabaseAdmin
                .from('patients')
                .select('id, full_name, risk_level, clinical_notes, updated_at')
                .eq('doctor_id', doctorId)
                .eq('risk_level', 'High')
                .limit(5);
            const alerts = (highRiskPatients || []).map((p) => ({
                name: p.full_name,
                note: `Risk level flagged to High. Notes: ${p.clinical_notes || 'Requires clinical review'}`,
                time: new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            // 4. Recent patient conversations / activity
            const { data: recentConvs } = await supabase_1.supabaseAdmin
                .from('conversations')
                .select('id, phone_number, direction, message_type, content, transcript, timestamp')
                .order('timestamp', { ascending: false })
                .limit(5);
            const activity = (recentConvs || []).map((c) => ({
                name: c.phone_number,
                text: c.direction === 'inbound'
                    ? `sent a ${c.message_type} message: "${c.transcript || c.content}"`
                    : `received DearPal AI response`,
                time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                tag: c.message_type === 'audio' ? 'Voice transcript' : 'Text chat',
            }));
            // 5. Next up sessions
            const { data: nextSessions } = await supabase_1.supabaseAdmin
                .from('sessions')
                .select('id, patient_id, created_at, diagnosis, patients(full_name)')
                .eq('doctor_id', doctorId)
                .order('created_at', { ascending: false })
                .limit(3);
            const followUps = (nextSessions || []).map((s) => ({
                initials: s.patients?.full_name ? s.patients.full_name.split(' ').map((n) => n[0]).join('').toUpperCase() : 'PT',
                name: s.patients?.full_name || 'Patient',
                time: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: s.diagnosis || 'Follow-up consult',
            }));
            res.status(200).json({
                status: 'success',
                data: {
                    activePatients: totalPatients || 0,
                    todaySessions: todaySessions || 0,
                    pendingFollowUps: 5,
                    unreadMessages: recentConvs?.length || 0,
                    alerts,
                    activity,
                    followUps,
                },
            });
        }
        catch (err) {
            logger_1.logger.error('Error in getStats dashboard controller', { error: err.message });
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboard.controller.js.map