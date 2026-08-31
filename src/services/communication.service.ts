import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';
import {
  CommunicationThread,
  CommunicationMessage,
  CreateThreadDTO,
  ThreadFilterQuery,
  ThreadType,
  SenderRole,
} from '../types/communication.types';

export interface CommunicationUser {
  id: string;
  role: 'doctor' | 'psw' | 'patient' | 'caretaker' | 'admin';
  name: string;
  email?: string;
  patientId?: string;
  caretakerId?: string;
}

export class CommunicationService {
  /**
   * List all authorized communication threads for the requesting user
   */
  async getThreads(user: CommunicationUser, query: ThreadFilterQuery = {}): Promise<CommunicationThread[]> {
    if (user.role === 'admin') {
      // Step 4: Admin does not gain automatic clinical message access
      return [];
    }

    const { roleFilter = 'all', unreadOnly = false, search = '', page = 1, limit = 50 } = query;

    let permittedPatientIds: string[] = [];
    let permittedPswPatientIds: string[] = [];
    const pswReferralStatusMap = new Map<string, { status: string; id: string }>();

    if (user.role === 'doctor') {
      const { data: patients, error: patErr } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('doctor_id', user.id);

      if (patErr) {
        logger.error('Failed to query doctor patients for threads', { error: patErr.message });
      }
      permittedPatientIds = (patients || []).map((p) => p.id);
    } else if (user.role === 'psw') {
      // Find referrals assigned or accepted by this PSW
      const { data: referrals, error: refErr } = await supabaseAdmin
        .from('referrals')
        .select('id, patient_id, status')
        .eq('psw_id', user.id)
        .in('status', ['pending', 'accepted', 'in_progress']);

      if (refErr) {
        logger.error('Failed to query referrals for PSW threads', { error: refErr.message });
      }

      for (const r of referrals || []) {
        permittedPswPatientIds.push(r.patient_id);
        pswReferralStatusMap.set(r.patient_id, { status: r.status, id: r.id });
      }

      // Also check direct patient assigned_psw_id
      const { data: assignedPatients } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('assigned_psw_id', user.id);

      for (const p of assignedPatients || []) {
        if (!permittedPswPatientIds.includes(p.id)) {
          permittedPswPatientIds.push(p.id);
          if (!pswReferralStatusMap.has(p.id)) {
            pswReferralStatusMap.set(p.id, { status: 'assigned', id: '' });
          }
        }
      }
      permittedPatientIds = permittedPswPatientIds;
    } else if (user.role === 'patient') {
      if (user.patientId) {
        permittedPatientIds = [user.patientId];
      } else {
        const { data: pat } = await supabaseAdmin
          .from('patients')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (pat) permittedPatientIds = [pat.id];
      }
    } else if (user.role === 'caretaker') {
      const cId = user.caretakerId || user.id;
      const { data: links } = await supabaseAdmin
        .from('patient_caretaker_links')
        .select('patient_id')
        .eq('caretaker_id', cId)
        .eq('status', 'active');
      permittedPatientIds = (links || []).map((l) => l.patient_id);
    }

    if (permittedPatientIds.length === 0 && user.role !== 'doctor' && user.role !== 'psw') {
      return [];
    }

    // Build thread query
    let threadQuery = supabaseAdmin.from('communication_threads').select('*');

    if (user.role === 'doctor') {
      if (permittedPatientIds.length > 0) {
        threadQuery = threadQuery.or(`doctor_id.eq.${user.id},patient_id.in.(${permittedPatientIds.join(',')})`);
      } else {
        threadQuery = threadQuery.eq('doctor_id', user.id);
      }
    } else if (user.role === 'psw') {
      if (permittedPatientIds.length > 0) {
        threadQuery = threadQuery.or(`psw_id.eq.${user.id},patient_id.in.(${permittedPatientIds.join(',')})`);
      } else {
        threadQuery = threadQuery.eq('psw_id', user.id);
      }
    } else if (user.role === 'patient') {
      threadQuery = threadQuery
        .in('patient_id', permittedPatientIds)
        .in('thread_type', ['patient_doctor', 'patient_psw']);
    } else if (user.role === 'caretaker') {
      threadQuery = threadQuery
        .in('patient_id', permittedPatientIds)
        .in('thread_type', ['caretaker_doctor', 'caretaker_psw']);
    }

    const { data: rawThreads, error: threadErr } = await threadQuery.order('last_message_at', { ascending: false });

    if (threadErr) {
      logger.error('Failed to query communication threads', { error: threadErr.message });
      return [];
    }

    const threads = rawThreads || [];
    if (threads.length === 0) return [];

    // Collect all patient IDs and caretaker IDs for enrichment
    const threadPatientIds = Array.from(new Set(threads.map((t) => t.patient_id)));
    const threadCaretakerIds = Array.from(new Set(threads.map((t) => t.caretaker_id).filter(Boolean)));
    const threadIds = threads.map((t) => t.id);

    // Fetch patient info
    const { data: patientRecords } = await supabaseAdmin
      .from('patients')
      .select('id, full_name, phone_number, doctor_id, assigned_psw_id')
      .in('id', threadPatientIds);

    const patientMap = new Map((patientRecords || []).map((p) => [p.id, p]));

    // Fetch caretaker info if any
    let caretakerMap = new Map<string, { mobile_number: string; full_name?: string }>();
    if (threadCaretakerIds.length > 0) {
      const { data: caretakers } = await supabaseAdmin
        .from('caretakers')
        .select('id, mobile_number')
        .in('id', threadCaretakerIds);
      caretakerMap = new Map((caretakers || []).map((c) => [c.id, c]));
    }

    // Fetch unread messages counts per thread
    const { data: unreadRows } = await supabaseAdmin
      .from('communication_messages')
      .select('thread_id')
      .in('thread_id', threadIds)
      .neq('sender_id', user.id)
      .is('read_at', null);

    const unreadCountMap = new Map<string, number>();
    for (const row of unreadRows || []) {
      unreadCountMap.set(row.thread_id, (unreadCountMap.get(row.thread_id) || 0) + 1);
    }

    // Enrich and filter threads
    const enrichedThreads: CommunicationThread[] = threads.map((t) => {
      const p = patientMap.get(t.patient_id);
      const c = t.caretaker_id ? caretakerMap.get(t.caretaker_id) : undefined;
      const refInfo = user.role === 'psw' ? pswReferralStatusMap.get(t.patient_id) : undefined;

      return {
        ...t,
        patient_name: p?.full_name || 'Patient',
        patient_phone: p?.phone_number || '',
        caretaker_phone: c?.mobile_number || '',
        caretaker_name: c?.full_name || (c ? 'Linked Caretaker' : undefined),
        unread_count: unreadCountMap.get(t.id) || 0,
        referral_status: refInfo?.status || (t.thread_type.includes('psw') ? 'Active' : undefined),
        referral_id: refInfo?.id || undefined,
      };
    });

    // Apply roleFilter
    let filtered = enrichedThreads;
    if (roleFilter === 'patients') {
      filtered = filtered.filter((t) => t.thread_type === 'patient_doctor' || t.thread_type === 'patient_psw');
    } else if (roleFilter === 'caretakers') {
      filtered = filtered.filter((t) => t.thread_type === 'caretaker_doctor' || t.thread_type === 'caretaker_psw');
    }

    // Apply unreadOnly
    if (unreadOnly) {
      filtered = filtered.filter((t) => (t.unread_count || 0) > 0);
    }

    // Apply search filter
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.patient_name?.toLowerCase().includes(s) ||
          t.patient_phone?.toLowerCase().includes(s) ||
          t.caretaker_name?.toLowerCase().includes(s) ||
          t.caretaker_phone?.toLowerCase().includes(s) ||
          t.last_message_preview?.toLowerCase().includes(s)
      );
    }

    const startIndex = (page - 1) * limit;
    return filtered.slice(startIndex, startIndex + limit);
  }

  /**
   * Get or create a communication thread with strict authorization check
   */
  async getOrCreateThread(user: CommunicationUser, dto: CreateThreadDTO): Promise<CommunicationThread> {
    const { patientId, threadType, targetProfessionalId } = dto;

    if (!patientId || !threadType) {
      throw new AppError('Patient ID and Thread Type are required', 400, true, 'INVALID_PARAMS');
    }

    // 1. Verify patient exists
    const { data: patient, error: patErr } = await supabaseAdmin
      .from('patients')
      .select('id, full_name, phone_number, doctor_id, assigned_psw_id, auth_user_id')
      .eq('id', patientId)
      .maybeSingle();

    if (patErr || !patient) {
      throw new AppError('Patient record not found', 404, true, 'PATIENT_NOT_FOUND');
    }

    // 2. Validate authorization based on user role and thread type
    let doctorId: string | null = null;
    let pswId: string | null = null;
    let caretakerId: string | null = null;
    const patientAuthUserId = patient.auth_user_id || null;

    if (user.role === 'doctor') {
      if (patient.doctor_id !== user.id) {
        throw new AppError('Unauthorized: You are not the assigned doctor for this patient', 403, true, 'DOCTOR_UNAUTHORIZED');
      }
      doctorId = user.id;

      if (threadType === 'caretaker_doctor') {
        // Find active caretaker
        const { data: link } = await supabaseAdmin
          .from('patient_caretaker_links')
          .select('caretaker_id')
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .maybeSingle();
        if (link) caretakerId = link.caretaker_id;
      }
    } else if (user.role === 'psw') {
      // Check active referral or assignment
      const { data: referral } = await supabaseAdmin
        .from('referrals')
        .select('id, status')
        .eq('patient_id', patientId)
        .eq('psw_id', user.id)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .maybeSingle();

      const isAssigned = patient.assigned_psw_id === user.id;
      if (!referral && !isAssigned) {
        throw new AppError('Unauthorized: No active referral or assignment for this patient', 403, true, 'PSW_UNAUTHORIZED');
      }
      pswId = user.id;

      if (threadType === 'caretaker_psw') {
        const { data: link } = await supabaseAdmin
          .from('patient_caretaker_links')
          .select('caretaker_id')
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .maybeSingle();
        if (link) caretakerId = link.caretaker_id;
      }
    } else if (user.role === 'patient') {
      if (patient.auth_user_id !== user.id && patient.id !== user.patientId) {
        throw new AppError('Unauthorized: You can only create threads for your own account', 403, true, 'PATIENT_UNAUTHORIZED');
      }

      if (threadType === 'patient_doctor') {
        doctorId = patient.doctor_id || targetProfessionalId || null;
      } else if (threadType === 'patient_psw') {
        pswId = patient.assigned_psw_id || targetProfessionalId || null;
      }
    } else if (user.role === 'caretaker') {
      const cId = user.caretakerId || user.id;
      const { data: link } = await supabaseAdmin
        .from('patient_caretaker_links')
        .select('id')
        .eq('patient_id', patientId)
        .eq('caretaker_id', cId)
        .eq('status', 'active')
        .maybeSingle();

      if (!link) {
        throw new AppError('Unauthorized: You are not an active caretaker for this patient', 403, true, 'CARETAKER_UNAUTHORIZED');
      }
      caretakerId = cId;

      if (threadType === 'caretaker_doctor') {
        doctorId = patient.doctor_id || targetProfessionalId || null;
      } else if (threadType === 'caretaker_psw') {
        pswId = patient.assigned_psw_id || targetProfessionalId || null;
      }
    }

    // 3. Find existing thread
    let query = supabaseAdmin
      .from('communication_threads')
      .select('*')
      .eq('patient_id', patientId)
      .eq('thread_type', threadType);

    if (caretakerId) {
      query = query.eq('caretaker_id', caretakerId);
    }
    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }
    if (pswId) {
      query = query.eq('psw_id', pswId);
    }

    const { data: existingThreads } = await query.maybeSingle();

    if (existingThreads) {
      return {
        ...existingThreads,
        patient_name: patient.full_name,
        patient_phone: patient.phone_number,
      };
    }

    // 4. Create new thread
    const { data: newThread, error: createErr } = await supabaseAdmin
      .from('communication_threads')
      .insert({
        patient_id: patientId,
        thread_type: threadType,
        doctor_id: doctorId,
        psw_id: pswId,
        caretaker_id: caretakerId,
        patient_auth_user_id: patientAuthUserId,
        last_message_at: new Date().toISOString(),
        last_message_preview: 'Conversation started',
      })
      .select()
      .single();

    if (createErr || !newThread) {
      logger.error('Failed to create communication thread', { error: createErr?.message });
      throw new AppError('Failed to initialize conversation thread', 500, false);
    }

    return {
      ...newThread,
      patient_name: patient.full_name,
      patient_phone: patient.phone_number,
    };
  }

  /**
   * Get single thread by ID with IDOR protection
   */
  async getThreadById(user: CommunicationUser, threadId: string): Promise<CommunicationThread> {
    const { data: thread, error } = await supabaseAdmin
      .from('communication_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (error || !thread) {
      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    await this.verifyThreadAccess(user, thread);

    // Enrich with patient and unread details
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('full_name, phone_number')
      .eq('id', thread.patient_id)
      .maybeSingle();

    let caretakerInfo: { full_name?: string; mobile_number: string } | undefined;
    if (thread.caretaker_id) {
      const { data: c } = await supabaseAdmin
        .from('caretakers')
        .select('mobile_number')
        .eq('id', thread.caretaker_id)
        .maybeSingle();
      if (c) caretakerInfo = c;
    }

    return {
      ...thread,
      patient_name: patient?.full_name || 'Patient',
      patient_phone: patient?.phone_number || '',
      caretaker_phone: caretakerInfo?.mobile_number,
      caretaker_name: caretakerInfo ? 'Linked Caretaker' : undefined,
    };
  }

  /**
   * Get messages for an authorized thread and mark unread incoming as read
   */
  async getThreadMessages(
    user: CommunicationUser,
    threadId: string,
    page = 1,
    limit = 100
  ): Promise<{ messages: CommunicationMessage[]; total: number }> {
    const thread = await this.getThreadById(user, threadId);

    // Fetch messages in chronological order
    const { data: messages, error, count } = await supabaseAdmin
      .from('communication_messages')
      .select('*', { count: 'exact' })
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      logger.error('Failed to query communication messages', { error: error.message, threadId });
      throw new AppError('Failed to fetch messages', 500, false);
    }

    // Automatically mark unread incoming messages as read
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('communication_messages')
      .update({ read_at: now })
      .eq('thread_id', threadId)
      .neq('sender_id', user.id)
      .is('read_at', null);

    return {
      messages: messages || [],
      total: count || (messages || []).length,
    };
  }

  /**
   * Send a direct message in an authorized thread
   */
  async sendMessage(user: CommunicationUser, threadId: string, content: string): Promise<CommunicationMessage> {
    const cleanContent = content?.trim();
    if (!cleanContent) {
      throw new AppError('Message content cannot be empty', 400, true, 'EMPTY_MESSAGE');
    }
    if (cleanContent.length > 4000) {
      throw new AppError('Message content exceeds 4000 character limit', 400, true, 'MESSAGE_TOO_LONG');
    }

    const { data: thread, error: threadErr } = await supabaseAdmin
      .from('communication_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !thread) {
      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    await this.verifyThreadAccess(user, thread);

    // If PSW, verify referral is still active
    if (user.role === 'psw') {
      const { data: referral } = await supabaseAdmin
        .from('referrals')
        .select('status')
        .eq('patient_id', thread.patient_id)
        .eq('psw_id', user.id)
        .in('status', ['accepted', 'in_progress', 'pending'])
        .maybeSingle();

      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('assigned_psw_id')
        .eq('id', thread.patient_id)
        .maybeSingle();

      if (!referral && patient?.assigned_psw_id !== user.id) {
        throw new AppError('Cannot send message: Active referral or assignment has ended', 403, true, 'REFERRAL_INACTIVE');
      }
    }

    // Determine sender role
    let senderRole: SenderRole = 'doctor';
    if (user.role === 'psw') senderRole = 'psw';
    else if (user.role === 'patient') senderRole = 'patient';
    else if (user.role === 'caretaker') senderRole = 'caretaker';

    // Insert message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('communication_messages')
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        sender_role: senderRole,
        sender_name: user.name || 'User',
        content: cleanContent,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgErr || !message) {
      logger.error('Failed to store communication message', { error: msgErr?.message, threadId });
      throw new AppError('Failed to send message', 500, false);
    }

    // Update thread last_message_at and last_message_preview
    const preview = cleanContent.length > 100 ? cleanContent.substring(0, 97) + '...' : cleanContent;
    await supabaseAdmin
      .from('communication_threads')
      .update({
        last_message_at: message.created_at,
        last_message_preview: preview,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId);

    logger.info('Communication message sent', {
      threadId,
      senderId: user.id,
      senderRole,
    });

    return message;
  }

  /**
   * Mark all unread messages in thread as read
   */
  async markThreadRead(user: CommunicationUser, threadId: string): Promise<{ success: boolean }> {
    const thread = await this.getThreadById(user, threadId);

    await supabaseAdmin
      .from('communication_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('thread_id', thread.id)
      .neq('sender_id', user.id)
      .is('read_at', null);

    return { success: true };
  }

  /**
   * Internal Helper: Strict IDOR & Relationship Verification
   */
  private async verifyThreadAccess(user: CommunicationUser, thread: CommunicationThread): Promise<void> {
    if (user.role === 'admin') {
      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    if (user.role === 'doctor') {
      if (thread.doctor_id === user.id) return;
      // Check if patient belongs to doctor
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('doctor_id')
        .eq('id', thread.patient_id)
        .maybeSingle();

      if (patient?.doctor_id === user.id) return;
      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    if (user.role === 'psw') {
      if (thread.psw_id === user.id) return;

      // Check active referral or assignment
      const { data: referral } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('patient_id', thread.patient_id)
        .eq('psw_id', user.id)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .maybeSingle();

      if (referral) return;

      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('assigned_psw_id')
        .eq('id', thread.patient_id)
        .maybeSingle();

      if (patient?.assigned_psw_id === user.id) return;

      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    if (user.role === 'patient') {
      if (thread.patient_auth_user_id === user.id) return;
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('auth_user_id')
        .eq('id', thread.patient_id)
        .maybeSingle();

      if (patient?.auth_user_id === user.id || thread.patient_id === user.patientId) return;
      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    if (user.role === 'caretaker') {
      const cId = user.caretakerId || user.id;
      if (thread.caretaker_id === cId) return;

      const { data: link } = await supabaseAdmin
        .from('patient_caretaker_links')
        .select('id')
        .eq('patient_id', thread.patient_id)
        .eq('caretaker_id', cId)
        .eq('status', 'active')
        .maybeSingle();

      if (link) return;
      throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
    }

    throw new AppError('Conversation thread not found', 404, true, 'NOT_FOUND');
  }
}
