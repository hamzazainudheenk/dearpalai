import { CommunicationService, CommunicationUser } from '../../src/services/communication.service';
import { supabaseAdmin } from '../../src/config/supabase';
import { AppError } from '../../src/middleware/error.middleware';

jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('CommunicationService', () => {
  let service: CommunicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunicationService();
  });

  describe('getThreads', () => {
    it('returns empty array for admin role to preserve clinical privacy', async () => {
      const adminUser: CommunicationUser = {
        id: 'admin-1',
        role: 'admin',
        name: 'Admin User',
      };

      const result = await service.getThreads(adminUser);
      expect(result).toEqual([]);
    });

    it('returns threads for treating doctor with enriched patient metadata and unread counts', async () => {
      const doctorUser: CommunicationUser = {
        id: 'doc-1',
        role: 'doctor',
        name: 'Dr. Smith',
      };

      // Mock patients query
      const mockPatientsFrom = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ id: 'pat-1' }],
            error: null,
          }),
        }),
      };

      // Mock threads query
      const mockThreadsFrom = {
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'thread-1',
                  patient_id: 'pat-1',
                  thread_type: 'patient_doctor',
                  doctor_id: 'doc-1',
                  last_message_at: '2026-08-30T10:00:00Z',
                  last_message_preview: 'Hello doctor',
                },
              ],
              error: null,
            }),
          }),
        }),
      };

      // Mock patient metadata query
      const mockPatientMetaFrom = {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: 'pat-1', full_name: 'John Thomas', phone_number: '+919876543210' }],
            error: null,
          }),
        }),
      };

      // Mock unread messages query
      const mockUnreadFrom = {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                data: [{ thread_id: 'thread-1' }],
                error: null,
              }),
            }),
          }),
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'patients') {
          return mockPatientsFrom;
        }
        if (table === 'communication_threads') {
          return mockThreadsFrom;
        }
        if (table === 'communication_messages') {
          return mockUnreadFrom;
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) };
      });

      // Override second call to patients with metadata
      mockPatientsFrom.select.mockImplementationOnce(() => ({
        eq: jest.fn().mockResolvedValue({ data: [{ id: 'pat-1' }], error: null }),
      })).mockImplementationOnce(() => ({
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'pat-1', full_name: 'John Thomas', phone_number: '+919876543210' }],
          error: null,
        }),
      }));

      const threads = await service.getThreads(doctorUser);

      expect(threads).toBeDefined();
      expect(Array.isArray(threads)).toBe(true);
      if (threads.length > 0) {
        expect(threads[0].patient_name).toBe('John Thomas');
        expect(threads[0].unread_count).toBe(1);
      }
    });

    it('restricts PSW threads only to patients with active referrals', async () => {
      const pswUser: CommunicationUser = {
        id: 'psw-1',
        role: 'psw',
        name: 'Sarah Worker',
      };

      // Mock referrals query returning active referral for pat-2
      const mockReferralsFrom = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'ref-1', patient_id: 'pat-2', status: 'in_progress' }],
              error: null,
            }),
          }),
        }),
      };

      const mockPatientsFrom = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          in: jest.fn().mockResolvedValue({
            data: [{ id: 'pat-2', full_name: 'Jane Doe', phone_number: '+919876500000' }],
            error: null,
          }),
        }),
      };

      const mockThreadsFrom = {
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'thread-psw-1',
                  patient_id: 'pat-2',
                  thread_type: 'patient_psw',
                  psw_id: 'psw-1',
                  last_message_at: '2026-08-30T11:00:00Z',
                  last_message_preview: 'PSW follow up',
                },
              ],
              error: null,
            }),
          }),
        }),
      };

      const mockUnreadFrom = {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'referrals') return mockReferralsFrom;
        if (table === 'patients') return mockPatientsFrom;
        if (table === 'communication_threads') return mockThreadsFrom;
        if (table === 'communication_messages') return mockUnreadFrom;
        return { select: jest.fn().mockReturnThis() };
      });

      const threads = await service.getThreads(pswUser);
      expect(threads).toHaveLength(1);
      expect(threads[0].patient_name).toBe('Jane Doe');
      expect(threads[0].referral_status).toBe('in_progress');
    });
  });

  describe('IDOR & Authorization Protection', () => {
    it('throws 404 when a doctor attempts to access another doctor patient thread', async () => {
      const doctorUser: CommunicationUser = {
        id: 'doc-1',
        role: 'doctor',
        name: 'Dr. Smith',
      };

      // Thread belongs to doc-2
      const mockThread = {
        id: 'thread-forbidden',
        patient_id: 'pat-other',
        thread_type: 'patient_doctor',
        doctor_id: 'doc-2',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'communication_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: mockThread, error: null }),
              }),
            }),
          };
        }
        if (table === 'patients') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { doctor_id: 'doc-2' }, error: null }),
              }),
            }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      });

      await expect(service.getThreadById(doctorUser, 'thread-forbidden')).rejects.toThrow(
        new AppError('Conversation thread not found', 404, true, 'NOT_FOUND')
      );
    });

    it('rejects PSW message sending when referral is no longer active', async () => {
      const pswUser: CommunicationUser = {
        id: 'psw-1',
        role: 'psw',
        name: 'Sarah Worker',
      };

      const mockThread = {
        id: 'thread-psw-inactive',
        patient_id: 'pat-ended',
        thread_type: 'patient_psw',
        psw_id: 'psw-1',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'communication_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: mockThread, error: null }),
              }),
            }),
          };
        }
        if (table === 'referrals') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn().mockReturnValue({
                    // No active referral (e.g. completed)
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'patients') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { assigned_psw_id: 'psw-different' }, error: null }),
              }),
            }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      });

      await expect(service.sendMessage(pswUser, 'thread-psw-inactive', 'Checking in')).rejects.toThrow(
        new AppError('Cannot send message: Active referral or assignment has ended', 403, true, 'REFERRAL_INACTIVE')
      );
    });

    it('rejects sending empty message content', async () => {
      const doctorUser: CommunicationUser = {
        id: 'doc-1',
        role: 'doctor',
        name: 'Dr. Smith',
      };

      await expect(service.sendMessage(doctorUser, 'thread-1', '   ')).rejects.toThrow(
        new AppError('Message content cannot be empty', 400, true, 'EMPTY_MESSAGE')
      );
    });
  });
});
