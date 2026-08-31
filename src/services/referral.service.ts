import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/error.middleware';

export interface CreateReferralDTO {
  patientId: string;
  pswId?: string;
  reason: string;
  selectedContext?: string;
  instructions?: string;
}

export interface CreateNoteDTO {
  note: string;
  noteType?: 'general' | 'call' | 'visit' | 'assessment' | 'follow_up';
}

export class ReferralService {
  /**
   * Doctor creates a new referral for their patient.
   */
  async createReferral(doctorId: string, dto: CreateReferralDTO) {
    const { patientId, pswId, reason, selectedContext, instructions } = dto;

    if (!patientId || !reason?.trim()) {
      throw new AppError('Patient ID and reason for referral are required', 400, true, 'INVALID_PAYLOAD');
    }

    // 1. Verify that the authenticated doctor owns this patient (Prevent IDOR)
    const { data: patient, error: patientErr } = await supabaseAdmin
      .from('patients')
      .select('id, full_name, doctor_id')
      .eq('id', patientId)
      .maybeSingle();

    if (patientErr || !patient) {
      throw new AppError('Patient not found', 404, true, 'PATIENT_NOT_FOUND');
    }

    if (patient.doctor_id !== doctorId) {
      logger.warn('Doctor attempted to refer a patient they do not own', { doctorId, patientId });
      throw new AppError('Unauthorized: You can only refer patients assigned to your care', 403, true, 'UNAUTHORIZED_PATIENT_ACCESS');
    }

    // 2. If a specific PSW was selected, verify they exist and have role = 'psw'
    let assignedPswId: string | null = null;
    if (pswId) {
      const { data: psw, error: pswErr } = await supabaseAdmin
        .from('doctors')
        .select('id, role')
        .eq('id', pswId)
        .maybeSingle();

      if (pswErr || !psw || psw.role !== 'psw') {
        throw new AppError('The selected counsellor is invalid or not registered as a PSW', 400, true, 'INVALID_PSW');
      }
      assignedPswId = psw.id;
    }

    // 3. Insert the referral record
    const { data: referral, error: insertErr } = await supabaseAdmin
      .from('referrals')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        psw_id: assignedPswId,
        reason: reason.trim(),
        selected_context: selectedContext?.trim() || '',
        instructions: instructions?.trim() || '',
        status: 'pending',
      })
      .select(`
        *,
        patient:patients (id, full_name, phone_number, age, gender, risk_level),
        doctor:doctors!referrals_doctor_id_fkey (id, full_name, clinic_name, email),
        psw:doctors!referrals_psw_id_fkey (id, full_name, email, posting)
      `)
      .single();

    if (insertErr || !referral) {
      logger.error('Failed to insert referral record in Supabase', { error: insertErr?.message });
      throw new AppError('Failed to create referral record', 500, false);
    }

    // 4. Update patient assigned_psw_id if targeted
    if (assignedPswId) {
      await supabaseAdmin
        .from('patients')
        .update({ assigned_psw_id: assignedPswId, updated_at: new Date().toISOString() })
        .eq('id', patientId);
    }

    logger.info('Referral created successfully', { referralId: referral.id, doctorId, patientId, pswId: assignedPswId });
    return referral;
  }

  /**
   * Doctor views all referrals for a specific patient under their care.
   */
  async getPatientReferrals(doctorId: string, patientId: string) {
    // Verify doctor ownership
    const { data: patient, error: patientErr } = await supabaseAdmin
      .from('patients')
      .select('id, doctor_id')
      .eq('id', patientId)
      .maybeSingle();

    if (patientErr || !patient) {
      throw new AppError('Patient not found', 404, true, 'PATIENT_NOT_FOUND');
    }

    if (patient.doctor_id !== doctorId) {
      throw new AppError('Unauthorized: Patient does not belong to your care', 403, true, 'UNAUTHORIZED_PATIENT_ACCESS');
    }

    const { data: referrals, error } = await supabaseAdmin
      .from('referrals')
      .select(`
        *,
        psw:doctors!referrals_psw_id_fkey (id, full_name, email, posting)
      `)
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch patient referrals', { error: error.message, patientId });
      throw new AppError('Failed to fetch patient referrals', 500, false);
    }

    return referrals || [];
  }

  /**
   * PSW retrieves their follow-up queue (assigned or unassigned pending).
   */
  async getPswReferrals(pswId: string, statusFilter?: string) {
    let query = supabaseAdmin
      .from('referrals')
      .select(`
        *,
        patient:patients (id, full_name, phone_number, age, gender, risk_level),
        doctor:doctors!referrals_doctor_id_fkey (id, full_name, clinic_name, email)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'All') {
      if (statusFilter === 'pending') {
        // Pending can be assigned directly to this PSW OR unassigned pool
        query = query.eq('status', 'pending').or(`psw_id.eq.${pswId},psw_id.is.null`);
      } else {
        query = query.eq('status', statusFilter).eq('psw_id', pswId);
      }
    } else {
      // Default: All referrals assigned to this PSW OR unassigned pending
      query = query.or(`psw_id.eq.${pswId},and(psw_id.is.null,status.eq.pending)`);
    }

    const { data: referrals, error } = await query;

    if (error) {
      logger.error('Failed to fetch PSW referrals', { error: error.message, pswId });
      throw new AppError('Failed to fetch referrals queue', 500, false);
    }

    return referrals || [];
  }

  /**
   * Get single referral with strict role-based access boundary.
   */
  async getReferralById(professionalId: string, role: 'doctor' | 'psw' | 'admin', referralId: string) {
    const { data: referral, error } = await supabaseAdmin
      .from('referrals')
      .select(`
        *,
        patient:patients (id, full_name, phone_number, age, gender, risk_level),
        doctor:doctors!referrals_doctor_id_fkey (id, full_name, clinic_name, email),
        psw:doctors!referrals_psw_id_fkey (id, full_name, email, posting)
      `)
      .eq('id', referralId)
      .maybeSingle();

    if (error || !referral) {
      throw new AppError('Referral not found', 404, true, 'REFERRAL_NOT_FOUND');
    }

    // Role-based boundary checks (Prevent IDOR)
    if (role === 'doctor' && referral.doctor_id !== professionalId) {
      throw new AppError('Unauthorized: You can only view referrals you created', 403, true, 'FORBIDDEN');
    }

    if (role === 'psw') {
      const isAssigned = referral.psw_id === professionalId;
      const isUnassignedPending = !referral.psw_id && referral.status === 'pending';
      if (!isAssigned && !isUnassignedPending) {
        throw new AppError('Unauthorized: You do not have access to this referral', 403, true, 'FORBIDDEN');
      }
    }

    return referral;
  }

  /**
   * PSW accepts a referral. (Transitions: pending -> accepted)
   */
  async acceptReferral(pswId: string, referralId: string) {
    const { data: referral, error: fetchErr } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .maybeSingle();

    if (fetchErr || !referral) {
      throw new AppError('Referral not found', 404, true, 'REFERRAL_NOT_FOUND');
    }

    // Validate status transition
    if (referral.status !== 'pending') {
      throw new AppError(`Cannot accept referral in '${referral.status}' state`, 400, true, 'INVALID_TRANSITION');
    }

    // Validate assignment authorization
    if (referral.psw_id && referral.psw_id !== pswId) {
      throw new AppError('Referral is already assigned to another counsellor', 403, true, 'ASSIGNED_TO_OTHER');
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('referrals')
      .update({
        status: 'accepted',
        psw_id: pswId,
        accepted_at: now,
        updated_at: now,
      })
      .eq('id', referralId)
      .select(`
        *,
        patient:patients (id, full_name, phone_number, age, gender, risk_level),
        doctor:doctors!referrals_doctor_id_fkey (id, full_name, clinic_name, email),
        psw:doctors!referrals_psw_id_fkey (id, full_name, email, posting)
      `)
      .single();

    if (updateErr || !updated) {
      logger.error('Failed to update referral to accepted', { error: updateErr?.message, referralId });
      throw new AppError('Failed to accept referral', 500, false);
    }

    // Update patient assigned PSW
    await supabaseAdmin
      .from('patients')
      .update({ assigned_psw_id: pswId, updated_at: now })
      .eq('id', referral.patient_id);

    logger.info('Referral accepted by PSW', { referralId, pswId });
    return updated;
  }

  /**
   * PSW starts follow-up. (Transitions: accepted -> in_progress)
   */
  async startReferral(pswId: string, referralId: string) {
    const { data: referral, error: fetchErr } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .maybeSingle();

    if (fetchErr || !referral) {
      throw new AppError('Referral not found', 404, true, 'REFERRAL_NOT_FOUND');
    }

    if (referral.psw_id !== pswId) {
      throw new AppError('Unauthorized: You are not assigned to this referral', 403, true, 'FORBIDDEN');
    }

    if (referral.status !== 'accepted') {
      throw new AppError(`Cannot start follow-up on referral with status '${referral.status}'`, 400, true, 'INVALID_TRANSITION');
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('referrals')
      .update({
        status: 'in_progress',
        started_at: now,
        updated_at: now,
      })
      .eq('id', referralId)
      .select(`
        *,
        patient:patients (id, full_name, phone_number, age, gender, risk_level),
        doctor:doctors!referrals_doctor_id_fkey (id, full_name, clinic_name, email),
        psw:doctors!referrals_psw_id_fkey (id, full_name, email, posting)
      `)
      .single();

    if (updateErr || !updated) {
      throw new AppError('Failed to update referral to in_progress', 500, false);
    }

    logger.info('Referral started by PSW', { referralId, pswId });
    return updated;
  }

  /**
   * PSW completes referral. (Transitions: in_progress/accepted -> completed)
   */
  async completeReferral(pswId: string, referralId: string) {
    const { data: referral, error: fetchErr } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .maybeSingle();

    if (fetchErr || !referral) {
      throw new AppError('Referral not found', 404, true, 'REFERRAL_NOT_FOUND');
    }

    if (referral.psw_id !== pswId) {
      throw new AppError('Unauthorized: You are not assigned to this referral', 403, true, 'FORBIDDEN');
    }

    if (referral.status !== 'in_progress' && referral.status !== 'accepted') {
      throw new AppError(`Cannot complete referral with status '${referral.status}'`, 400, true, 'INVALID_TRANSITION');
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('referrals')
      .update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', referralId)
      .select(`
        *,
        patient:patients (id, full_name, phone_number, age, gender, risk_level),
        doctor:doctors!referrals_doctor_id_fkey (id, full_name, clinic_name, email),
        psw:doctors!referrals_psw_id_fkey (id, full_name, email, posting)
      `)
      .single();

    if (updateErr || !updated) {
      throw new AppError('Failed to complete referral', 500, false);
    }

    logger.info('Referral completed by PSW', { referralId, pswId });
    return updated;
  }

  /**
   * Fetch follow-up notes for an authorized Doctor or PSW.
   */
  async getReferralNotes(professionalId: string, role: 'doctor' | 'psw' | 'admin', referralId: string) {
    // 1. Verify access to referral
    await this.getReferralById(professionalId, role, referralId);

    // 2. Fetch notes
    const { data: notes, error } = await supabaseAdmin
      .from('psw_notes')
      .select(`
        *,
        psw:doctors!psw_notes_psw_id_fkey (id, full_name, email, posting)
      `)
      .eq('referral_id', referralId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch referral notes', { error: error.message, referralId });
      throw new AppError('Failed to fetch referral notes', 500, false);
    }

    return notes || [];
  }

  /**
   * Assigned PSW records a follow-up note.
   */
  async createReferralNote(pswId: string, referralId: string, dto: CreateNoteDTO) {
    const { note, noteType = 'general' } = dto;

    if (!note?.trim()) {
      throw new AppError('Note content cannot be empty', 400, true, 'INVALID_NOTE');
    }

    // Verify referral exists and is assigned to this PSW
    const { data: referral, error: fetchErr } = await supabaseAdmin
      .from('referrals')
      .select('id, patient_id, psw_id, status')
      .eq('id', referralId)
      .maybeSingle();

    if (fetchErr || !referral) {
      throw new AppError('Referral not found', 404, true, 'REFERRAL_NOT_FOUND');
    }

    if (referral.psw_id !== pswId) {
      throw new AppError('Unauthorized: You can only record notes on referrals assigned to you', 403, true, 'FORBIDDEN');
    }

    const { data: newNote, error: insertErr } = await supabaseAdmin
      .from('psw_notes')
      .insert({
        referral_id: referralId,
        patient_id: referral.patient_id,
        psw_id: pswId,
        note: note.trim(),
        note_type: noteType,
      })
      .select(`
        *,
        psw:doctors!psw_notes_psw_id_fkey (id, full_name, email, posting)
      `)
      .single();

    if (insertErr || !newNote) {
      logger.error('Failed to insert PSW note', { error: insertErr?.message });
      throw new AppError('Failed to record follow-up note', 500, false);
    }

    logger.info('PSW note recorded successfully', { noteId: newNote.id, referralId, pswId });
    return newNote;
  }

  /**
   * List available counsellors for doctor referral selection.
   */
  async getAvailablePsws() {
    const { data: psws, error } = await supabaseAdmin
      .from('doctors')
      .select('id, full_name, email, posting, clinic_name')
      .eq('role', 'psw')
      .order('full_name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch available PSWs', { error: error.message });
      throw new AppError('Failed to fetch available counsellors', 500, false);
    }

    return psws || [];
  }
}
