"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationController = void 0;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
class ConversationController {
    /**
     * GET /api/patients/:id/conversations
     * Retrieves conversation history for a patient.
     */
    async getConversations(req, res) {
        try {
            const doctorId = req.doctor?.id;
            const { id: patientId } = req.params;
            if (!doctorId) {
                res.status(401).json({ status: 'error', message: 'Unauthorized' });
                return;
            }
            // First check if patient belongs to doctor
            const { data: patient } = await supabase_1.supabaseAdmin
                .from('patients')
                .select('phone_number')
                .eq('id', patientId)
                .eq('doctor_id', doctorId)
                .single();
            if (!patient) {
                res.status(404).json({ status: 'error', message: 'Patient not found' });
                return;
            }
            // Fetch conversations by patient_id or phone_number
            const { data, error } = await supabase_1.supabaseAdmin
                .from('conversations')
                .select('*')
                .or(`patient_id.eq.${patientId},phone_number.eq.${patient.phone_number}`)
                .order('timestamp', { ascending: true });
            if (error) {
                logger_1.logger.error('Failed to fetch conversations', { error: error.message });
                res.status(500).json({ status: 'error', message: error.message });
                return;
            }
            res.status(200).json({ status: 'success', data: data || [] });
        }
        catch (err) {
            logger_1.logger.error('Error in getConversations controller', { error: err.message });
            res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
}
exports.ConversationController = ConversationController;
//# sourceMappingURL=conversation.controller.js.map