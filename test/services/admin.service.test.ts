import { AdminService } from '@services/admin.service';
import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';

jest.mock('@config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
  },
}));

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    service = new AdminService();
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('aggregates real system counts accurately', async () => {
      const mockDoctors = [
        { id: '1', role: 'doctor', is_active: true },
        { id: '2', role: 'doctor', is_active: false },
        { id: '3', role: 'psw', is_active: true },
      ];
      const mockReferrals = [
        { id: 'r1', status: 'pending' },
        { id: 'r2', status: 'accepted' },
        { id: 'r3', status: 'completed' },
      ];
      const mockDocs = [
        { id: 'd1', status: 'completed' },
        { id: 'd2', status: 'processing' },
      ];

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'doctors') {
          return {
            select: jest.fn().mockResolvedValue({ data: mockDoctors, error: null }),
          };
        }
        if (table === 'patients') {
          return {
            select: jest.fn().mockResolvedValue({ count: 15, error: null }),
          };
        }
        if (table === 'referrals') {
          return {
            select: jest.fn().mockResolvedValue({ data: mockReferrals, error: null }),
          };
        }
        if (table === 'knowledge_documents') {
          return {
            select: jest.fn().mockResolvedValue({ data: mockDocs, error: null }),
          };
        }
        if (table === 'knowledge_chunks') {
          return {
            select: jest.fn().mockResolvedValue({ count: 85, error: null }),
          };
        }
        return {};
      });

      const stats = await service.getDashboardStats();

      expect(stats.professionals.total).toBe(3);
      expect(stats.professionals.doctors.total).toBe(2);
      expect(stats.professionals.doctors.active).toBe(1);
      expect(stats.professionals.doctors.inactive).toBe(1);
      expect(stats.professionals.psws.total).toBe(1);
      expect(stats.professionals.psws.active).toBe(1);
      expect(stats.patients.total).toBe(15);
      expect(stats.referrals.pending).toBe(1);
      expect(stats.referrals.active).toBe(1);
      expect(stats.referrals.completed).toBe(1);
      expect(stats.knowledgeBase.totalDocuments).toBe(2);
      expect(stats.knowledgeBase.totalChunks).toBe(85);
    });
  });

  describe('createProfessional', () => {
    it('successfully creates Doctor account with auth and profile', async () => {
      const mockAuthUser = { id: 'new-doc-id', email: 'dr.smith@clinic.com' };
      const mockProfile = {
        id: 'new-doc-id',
        full_name: 'Dr. John Smith',
        email: 'dr.smith@clinic.com',
        role: 'doctor',
        employee_id: 'DOC-101',
        is_active: true,
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'doctors') {
          const queryObj: any = {
            select: jest.fn().mockImplementation(() => queryObj),
            eq: jest.fn().mockImplementation(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
            upsert: jest.fn().mockImplementation(() => ({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
                single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
              }),
            })),
          };
          return queryObj;
        }
        return {};
      });

      (supabaseAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const result = await service.createProfessional('admin-id', {
        role: 'doctor',
        fullName: 'Dr. John Smith',
        email: 'dr.smith@clinic.com',
        employeeId: 'DOC-101',
        clinicName: 'Metro Clinic',
      });

      expect(result.id).toBe('new-doc-id');
      expect(result.role).toBe('doctor');
      expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'dr.smith@clinic.com',
          email_confirm: true,
        })
      );
    });

    it('rejects duplicate email with 400', async () => {
      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'doctors') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing-id', email: 'taken@clinic.com' }, error: null }),
          };
        }
        return {};
      });

      await expect(
        service.createProfessional('admin-id', {
          role: 'doctor',
          fullName: 'Dr. Duplicate',
          email: 'taken@clinic.com',
        })
      ).rejects.toThrow(AppError);
    });

    it('rejects duplicate employee ID with 400', async () => {
      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'doctors') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((col: string, val: string) => {
              if (col === 'email') {
                return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
              }
              if (col === 'employee_id') {
                return { maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'doc-1', employee_id: 'DOC-99' }, error: null }) };
              }
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          };
        }
        return {};
      });

      await expect(
        service.createProfessional('admin-id', {
          role: 'psw',
          fullName: 'PSW Duplicate ID',
          email: 'unique@clinic.com',
          employeeId: 'DOC-99',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('setProfessionalStatus', () => {
    it('updates professional is_active and syncs auth metadata', async () => {
      const mockUpdated = { id: 'doc-1', is_active: false };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'doctors') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
          };
        }
        return {};
      });

      (supabaseAdmin.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      const result = await service.setProfessionalStatus('doc-1', false);

      expect(result.is_active).toBe(false);
      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith('doc-1', {
        user_metadata: { is_active: false },
      });
    });
  });
});
