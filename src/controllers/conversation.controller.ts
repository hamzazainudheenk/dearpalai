import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';

export class ConversationController {
  /**
   * GET /api/patients/:id/conversations
   * Retrieves conversation history for a patient.
   */
  async getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const doctorId = req.doctor?.id;
      const { id: patientId } = req.params;

      if (!doctorId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      // First check if patient belongs to doctor
      const { data: patient } = await supabaseAdmin
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
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .or(`patient_id.eq.${patientId},phone_number.eq.${patient.phone_number}`)
        .order('timestamp', { ascending: true });

      if (error) {
        logger.error('Failed to fetch conversations', { error: error.message });
        res.status(500).json({ status: 'error', message: error.message });
        return;
      }

      res.status(200).json({ status: 'success', data: data || [] });
    } catch (err) {
      logger.error('Error in getConversations controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }
}
