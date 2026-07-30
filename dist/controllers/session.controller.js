"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionController = void 0;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
class SessionController {
    /**
     * POST /api/patients/:id/sessions
     * Adds a clinical session note for a patient.
     */
    async createSession(req, res) {
        try {
            const doctorId = req.doctor?.id;
            const { id: patientId } = req.params;
            if (!doctorId) {
                res.status(401).json({ status: 'error', message: 'Unauthorized' });
                return;
            }
            const { diagnosis, clinicalNotes, treatmentPlan, followUpNotes, riskLevel } = req.body;
            const { data: session, error } = await supabase_1.supabaseAdmin
                .from('sessions')
                .insert({
                patient_id: patientId,
                doctor_id: doctorId,
                diagnosis: diagnosis || '',
                clinical_notes: clinicalNotes || '',
                treatment_plan: treatmentPlan || '',
                follow_up_notes: followUpNotes || '',
                risk_level: riskLevel || 'Low',
            })
                .select()
                .single();
            if (error) {
                logger_1.logger.error('Failed to create session', { error: error.message });
                res.status(500).json({ status: 'error', message: error.message });
                return;
            }
            // If risk level changed, update patient record as well
            if (riskLevel) {
                await supabase_1.supabaseAdmin
                    .from('patients')
                    .update({ risk_level: riskLevel, updated_at: new Date().toISOString() })
                    .eq('id', patientId);
            }
            res.status(201).json({ status: 'success', data: session });
        }
        catch (err) {
            logger_1.logger.error('Error in createSession controller', { error: err.message });
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
    /**
     * GET /api/patients/:id/sessions
     * Gets list of sessions for a specific patient.
     */
    async getSessions(req, res) {
        try {
            const doctorId = req.doctor?.id;
            const { id: patientId } = req.params;
            if (!doctorId) {
                res.status(401).json({ status: 'error', message: 'Unauthorized' });
                return;
            }
            const { data, error } = await supabase_1.supabaseAdmin
                .from('sessions')
                .select('*')
                .eq('patient_id', patientId)
                .eq('doctor_id', doctorId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.logger.error('Failed to fetch sessions', { error: error.message });
                res.status(500).json({ status: 'error', message: error.message });
                return;
            }
            res.status(200).json({ status: 'success', data: data || [] });
        }
        catch (err) {
            logger_1.logger.error('Error in getSessions controller', { error: err.message });
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
}
exports.SessionController = SessionController;
//# sourceMappingURL=session.controller.js.map