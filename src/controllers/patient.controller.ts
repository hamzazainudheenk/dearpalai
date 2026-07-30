import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { supabaseAdmin } from '@config/supabase';
import { container } from '../container';
import { MessageTemplates } from '@config/messages';
import { logger } from '@utils/logger';

export class PatientController {
  /**
   * POST /api/patients
   * Creates a new patient record in Supabase and automatically sends a WhatsApp welcome message.
   */
  async createPatient(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const doctorId = req.doctor?.id;
      if (!doctorId) {
        res.status(401).json({ status: 'error', message: 'Doctor ID missing from request' });
        return;
      }

      const { fullName, phoneNumber, age, gender, diagnosis, clinicalNotes, riskLevel, sendWelcome } = req.body;

      if (!fullName || !phoneNumber) {
        res.status(400).json({ status: 'error', message: 'Full name and WhatsApp phone number are required' });
        return;
      }

      // Format phone number to clean string
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

      // Insert into Supabase
      const { data: patient, error } = await supabaseAdmin
        .from('patients')
        .insert({
          doctor_id: doctorId,
          full_name: fullName,
          phone_number: cleanPhone,
          age: age ? parseInt(age, 10) : null,
          gender: gender || 'Unspecified',
          diagnosis: diagnosis || '',
          clinical_notes: clinicalNotes || '',
          risk_level: riskLevel || 'Low',
          status: 'Active',
        })
        .select()
        .single();

      if (error || !patient) {
        logger.error('Failed to create patient in Supabase', { error: error?.message });
        res.status(500).json({ status: 'error', message: error?.message || 'Failed to create patient' });
        return;
      }

      logger.info('Patient created successfully', { patientId: patient.id, phoneNumber: cleanPhone });

      // Automatically send WhatsApp welcome message if requested or by default
      if (sendWelcome !== false) {
        try {
          const welcomeText = `Hello ${fullName}! 👋 ${MessageTemplates.TEXT_RECEIVED}`;
          await container.whatsAppService.sendTextMessage(cleanPhone, welcomeText);
          
          // Log outbound welcome message into conversations table
          await supabaseAdmin.from('conversations').insert({
            patient_id: patient.id,
            phone_number: cleanPhone,
            direction: 'outbound',
            message_type: 'text',
            content: welcomeText,
            timestamp: new Date().toISOString(),
          });

          logger.info('WhatsApp welcome message sent to new patient', { patientId: patient.id });
        } catch (waError) {
          logger.warn('Failed to send WhatsApp welcome message during patient creation', {
            patientId: patient.id,
            error: (waError as Error).message,
          });
        }
      }

      res.status(201).json({ status: 'success', data: patient });
    } catch (err) {
      logger.error('Error in createPatient controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/patients
   * Lists patients for the logged-in doctor with search and pagination.
   */
  async getPatients(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const doctorId = req.doctor?.id;
      if (!doctorId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const search = (req.query.search as string) || '';
      const risk = (req.query.risk as string) || '';
      const status = (req.query.status as string) || '';
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('patients')
        .select('*', { count: 'exact' })
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
      }
      if (risk && risk !== 'All') {
        query = query.eq('risk_level', risk);
      }
      if (status && status !== 'All') {
        query = query.eq('status', status);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        logger.error('Failed to fetch patients', { error: error.message });
        res.status(500).json({ status: 'error', message: error.message });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: data || [],
        meta: {
          total: count || 0,
          page,
          limit,
          totalPages: count ? Math.ceil(count / limit) : 1,
        },
      });
    } catch (err) {
      logger.error('Error in getPatients controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/patients/:id
   * Retrieves single patient profile.
   */
  async getPatientById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const doctorId = req.doctor?.id;
      const { id } = req.params;

      if (!doctorId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('id', id)
        .eq('doctor_id', doctorId)
        .single();

      if (error || !data) {
        res.status(404).json({ status: 'error', message: 'Patient not found' });
        return;
      }

      res.status(200).json({ status: 'success', data });
    } catch (err) {
      logger.error('Error in getPatientById controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }
}
