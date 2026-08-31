import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/error.middleware';

export interface CreateProfessionalDTO {
  role: 'doctor' | 'psw';
  fullName: string;
  employeeId?: string;
  posting?: string;
  clinicName?: string;
  email: string;
  initialPassword?: string;
  isActive?: boolean;
}

export interface UpdateProfessionalDTO {
  fullName?: string;
  employeeId?: string;
  posting?: string;
  clinicName?: string;
  email?: string;
  isActive?: boolean;
}

export class AdminService {
  /**
   * High-Level Real Dashboard System Metrics
   */
  async getDashboardStats() {
    try {
      // 1. Professionals metrics
      let allProfessionals: any[] = [];
      const { data: profsWithActive, error: profErr } = await supabaseAdmin
        .from('doctors')
        .select('id, role, is_active');

      if (profErr) {
        const { data: fallbackProfs } = await supabaseAdmin
          .from('doctors')
          .select('id, role');
        allProfessionals = fallbackProfs || [];
      } else {
        allProfessionals = profsWithActive || [];
      }

      const professionalsList = allProfessionals || [];
      const doctors = professionalsList.filter((p) => p.role === 'doctor');
      const psws = professionalsList.filter((p) => p.role === 'psw');

      const totalDoctors = doctors.length;
      const activeDoctors = doctors.filter((d) => d.is_active !== false).length;
      const inactiveDoctors = doctors.filter((d) => d.is_active === false).length;

      const totalPsws = psws.length;
      const activePsws = psws.filter((p) => p.is_active !== false).length;
      const inactivePsws = psws.filter((p) => p.is_active === false).length;

      const totalProfessionals = totalDoctors + totalPsws;

      // 2. Patients metrics
      const { count: totalPatients, error: patErr } = await supabaseAdmin
        .from('patients')
        .select('*', { count: 'exact', head: true });

      if (patErr) {
        logger.error('Failed to query patients count for admin dashboard', { error: patErr.message });
      }

      // 3. Referrals metrics
      const { data: referrals, error: refErr } = await supabaseAdmin
        .from('referrals')
        .select('id, status');

      if (refErr) {
        logger.error('Failed to query referrals for admin dashboard', { error: refErr.message });
      }

      const referralList = referrals || [];
      const pendingReferrals = referralList.filter((r) => r.status === 'pending').length;
      const activeReferrals = referralList.filter(
        (r) => r.status === 'accepted' || r.status === 'in_progress'
      ).length;
      const completedReferrals = referralList.filter((r) => r.status === 'completed').length;

      // 4. Knowledge Base metrics
      const { data: documents, error: docErr } = await supabaseAdmin
        .from('knowledge_documents')
        .select('id, status');

      if (docErr) {
        logger.error('Failed to query knowledge documents for admin dashboard', { error: docErr.message });
      }

      const docList = documents || [];
      const totalDocuments = docList.length;
      const processingDocuments = docList.filter((d) => d.status === 'processing').length;
      const completedDocuments = docList.filter((d) => d.status === 'completed').length;
      const failedDocuments = docList.filter((d) => d.status === 'failed').length;

      const { count: totalChunks, error: chunkErr } = await supabaseAdmin
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true });

      if (chunkErr) {
        logger.error('Failed to query knowledge chunks for admin dashboard', { error: chunkErr.message });
      }

      return {
        professionals: {
          total: totalProfessionals,
          doctors: {
            total: totalDoctors,
            active: activeDoctors,
            inactive: inactiveDoctors,
          },
          psws: {
            total: totalPsws,
            active: activePsws,
            inactive: inactivePsws,
          },
        },
        patients: {
          total: totalPatients || 0,
        },
        referrals: {
          total: referralList.length,
          pending: pendingReferrals,
          active: activeReferrals,
          completed: completedReferrals,
        },
        knowledgeBase: {
          totalDocuments,
          processing: processingDocuments,
          completed: completedDocuments,
          failed: failedDocuments,
          totalChunks: totalChunks || 0,
        },
      };
    } catch (err) {
      logger.error('Unexpected error in getDashboardStats', { error: (err as Error).message });
      throw new AppError('Failed to fetch admin dashboard statistics', 500, false);
    }
  }

  /**
   * List professionals with filtering, searching, and assigned stats
   */
  async getProfessionals(params?: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { role, status, search, page = 1, limit = 50 } = params || {};
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('doctors')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Exclude admins from the operational professional list unless explicitly asked
    if (role && role !== 'All') {
      query = query.eq('role', role);
    } else {
      query = query.in('role', ['doctor', 'psw']);
    }

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (search?.trim()) {
      const s = search.trim();
      query = query.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,employee_id.ilike.%${s}%,posting.ilike.%${s}%,clinic_name.ilike.%${s}%`
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data: professionals, count, error } = await query;

    if (error) {
      logger.error('Failed to list professionals for admin', { error: error.message });
      throw new AppError('Failed to fetch professionals list', 500, false);
    }

    const profList = professionals || [];

    // Query patient & referral stats for each professional
    const populated = await Promise.all(
      profList.map(async (prof) => {
        let assignedPatientsCount = 0;
        let activeReferralsCount = 0;

        if (prof.role === 'doctor') {
          const { count: patCount } = await supabaseAdmin
            .from('patients')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', prof.id);
          assignedPatientsCount = patCount || 0;

          const { count: refCount } = await supabaseAdmin
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', prof.id)
            .in('status', ['pending', 'accepted', 'in_progress']);
          activeReferralsCount = refCount || 0;
        } else if (prof.role === 'psw') {
          const { count: patCount } = await supabaseAdmin
            .from('patients')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_psw_id', prof.id);
          assignedPatientsCount = patCount || 0;

          const { count: refCount } = await supabaseAdmin
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('psw_id', prof.id)
            .in('status', ['accepted', 'in_progress']);
          activeReferralsCount = refCount || 0;
        }

        return {
          ...prof,
          is_active: prof.is_active !== false,
          assignedPatientsCount,
          activeReferralsCount,
        };
      })
    );

    return {
      professionals: populated,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    };
  }

  /**
   * Get single professional profile with stats
   */
  async getProfessionalById(id: string) {
    const { data: prof, error } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !prof) {
      throw new AppError('Professional not found', 404, true, 'PROFESSIONAL_NOT_FOUND');
    }

    let assignedPatientsCount = 0;
    let activeReferralsCount = 0;

    if (prof.role === 'doctor') {
      const { count: patCount } = await supabaseAdmin
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', prof.id);
      assignedPatientsCount = patCount || 0;

      const { count: refCount } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', prof.id)
        .in('status', ['pending', 'accepted', 'in_progress']);
      activeReferralsCount = refCount || 0;
    } else if (prof.role === 'psw') {
      const { count: patCount } = await supabaseAdmin
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_psw_id', prof.id);
      assignedPatientsCount = patCount || 0;

      const { count: refCount } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('psw_id', prof.id)
        .in('status', ['accepted', 'in_progress']);
      activeReferralsCount = refCount || 0;
    }

    return {
      ...prof,
      is_active: prof.is_active !== false,
      assignedPatientsCount,
      activeReferralsCount,
    };
  }

  /**
   * Admin creates a new Doctor or PSW account securely
   */
  async createProfessional(adminId: string, dto: CreateProfessionalDTO) {
    const { role, fullName, employeeId, posting, clinicName, email, initialPassword, isActive = true } = dto;

    if (!role || (role !== 'doctor' && role !== 'psw')) {
      throw new AppError('Valid professional role (doctor or psw) is required', 400, true, 'INVALID_ROLE');
    }

    if (!fullName?.trim()) {
      throw new AppError('Full name is required', 400, true, 'INVALID_NAME');
    }

    if (!email?.trim() || !email.includes('@')) {
      throw new AppError('Valid work email is required', 400, true, 'INVALID_EMAIL');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employeeId?.trim() || '';

    // 1. Check unique email in doctors table
    const { data: existingEmail } = await supabaseAdmin
      .from('doctors')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      throw new AppError('A professional account with this email already exists', 400, true, 'EMAIL_EXISTS');
    }

    // 2. Check unique employeeId if provided
    if (cleanEmpId) {
      const { data: existingEmp } = await supabaseAdmin
        .from('doctors')
        .select('id, employee_id')
        .eq('employee_id', cleanEmpId)
        .maybeSingle();

      if (existingEmp) {
        throw new AppError(`A professional account with ID '${cleanEmpId}' already exists`, 400, true, 'EMPLOYEE_ID_EXISTS');
      }
    }

    // Generate secure temporary password if not provided
    const password = initialPassword?.trim() || `DearPal#${Math.random().toString(36).substring(2, 8)}!`;

    // 3. Create Auth user via Supabase Admin API
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role,
        employee_id: cleanEmpId,
        posting: posting?.trim() || '',
        clinic_name: clinicName?.trim() || '',
        is_active: isActive,
      },
    });

    if (authErr || !authData.user) {
      logger.error('Failed to create auth user in Supabase Admin', { error: authErr?.message });
      throw new AppError(authErr?.message || 'Failed to create professional authentication user', 500, false);
    }

    const userId = authData.user.id;

    // 4. Create/Upsert record in doctors table with graceful fallback for schema cache
    const profilePayload: Record<string, any> = {
      id: userId,
      full_name: fullName.trim(),
      email: cleanEmail,
      role,
      clinic_name: clinicName?.trim() || posting?.trim() || '',
    };
    if (cleanEmpId) profilePayload.employee_id = cleanEmpId;
    if (posting?.trim()) profilePayload.posting = posting.trim();
    if (isActive !== undefined) profilePayload.is_active = isActive;

    let { data: profile, error: profileErr } = await supabaseAdmin
      .from('doctors')
      .upsert(profilePayload)
      .select()
      .maybeSingle();

    if (profileErr && (profileErr.message.includes('column') || profileErr.message.includes('schema cache'))) {
      logger.warn('Retrying doctor profile upsert with core fields due to schema cache:', { error: profileErr.message });
      const { data: coreProfile, error: coreErr } = await supabaseAdmin
        .from('doctors')
        .upsert({
          id: userId,
          full_name: fullName.trim(),
          email: cleanEmail,
          role,
          clinic_name: clinicName?.trim() || posting?.trim() || '',
        })
        .select()
        .maybeSingle();

      profile = coreProfile;
      profileErr = coreErr;
    }

    if (profileErr || !profile) {
      logger.error('Failed to create doctor profile after auth creation', { error: profileErr?.message, userId });
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new AppError(profileErr?.message || 'Failed to create professional profile record', 500, false);
    }

    logger.info('Admin created new professional account', {
      adminId,
      createdId: userId,
      role,
      email: cleanEmail,
      employeeId: cleanEmpId,
    });

    return {
      ...profile,
      initialPasswordProvided: !!initialPassword,
    };
  }

  /**
   * Edit professional profile fields
   */
  async updateProfessional(id: string, dto: UpdateProfessionalDTO) {
    const { fullName, employeeId, posting, clinicName, email, isActive } = dto;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing) {
      throw new AppError('Professional not found', 404, true, 'PROFESSIONAL_NOT_FOUND');
    }

    // Check unique employeeId if updated
    if (employeeId !== undefined && employeeId.trim() !== '' && employeeId.trim() !== existing.employee_id) {
      const { data: dupEmp } = await supabaseAdmin
        .from('doctors')
        .select('id')
        .eq('employee_id', employeeId.trim())
        .neq('id', id)
        .maybeSingle();

      if (dupEmp) {
        throw new AppError(`Employee ID '${employeeId}' is already in use by another professional`, 400, true, 'EMPLOYEE_ID_EXISTS');
      }
    }

    // Check unique email if updated
    if (email !== undefined && email.trim().toLowerCase() !== existing.email) {
      const cleanEmail = email.trim().toLowerCase();
      const { data: dupEmail } = await supabaseAdmin
        .from('doctors')
        .select('id')
        .eq('email', cleanEmail)
        .neq('id', id)
        .maybeSingle();

      if (dupEmail) {
        throw new AppError('Email address is already in use by another professional', 400, true, 'EMAIL_EXISTS');
      }

      // Update Supabase Auth email
      await supabaseAdmin.auth.admin.updateUserById(id, { email: cleanEmail });
    }

    const updates: Record<string, any> = {};
    if (fullName !== undefined) updates.full_name = fullName.trim();
    if (employeeId !== undefined) updates.employee_id = employeeId.trim();
    if (posting !== undefined) updates.posting = posting.trim();
    if (clinicName !== undefined) updates.clinic_name = clinicName.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('doctors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr || !updated) {
      logger.error('Failed to update professional profile', { error: updateErr?.message, id });
      throw new AppError('Failed to update professional profile', 500, false);
    }

    // Sync metadata to Supabase Auth
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: {
        full_name: updated.full_name,
        role: updated.role,
        employee_id: updated.employee_id,
        posting: updated.posting,
        clinic_name: updated.clinic_name,
        is_active: updated.is_active,
      },
    });

    logger.info('Admin updated professional profile', { id, updates });
    return updated;
  }

  /**
   * Activate or Deactivate a professional account
   */
  async setProfessionalStatus(id: string, isActive: boolean) {
    const { data: updated, error } = await supabaseAdmin
      .from('doctors')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !updated) {
      throw new AppError('Professional not found or failed to update status', 404, true, 'PROFESSIONAL_NOT_FOUND');
    }

    // Sync to Supabase Auth metadata
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: {
        is_active: isActive,
      },
    });

    logger.info(`Admin set professional status to ${isActive ? 'active' : 'inactive'}`, { id, isActive });
    return updated;
  }

  /**
   * Reset professional password
   */
  async resetProfessionalPassword(id: string, newPassword?: string) {
    const { data: prof, error: findErr } = await supabaseAdmin
      .from('doctors')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !prof) {
      throw new AppError('Professional not found', 404, true, 'PROFESSIONAL_NOT_FOUND');
    }

    const passwordToSet = newPassword?.trim() || `DearPal#${Math.random().toString(36).substring(2, 8)}!`;

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: passwordToSet,
    });

    if (updateErr) {
      logger.error('Failed to reset professional password in Supabase Admin', { error: updateErr.message, id });
      throw new AppError('Failed to reset password', 500, false);
    }

    logger.info('Admin reset professional password', { id, email: prof.email });
    return {
      status: 'success',
      message: 'Password reset successfully',
      temporaryPassword: !newPassword ? passwordToSet : undefined,
    };
  }
}
