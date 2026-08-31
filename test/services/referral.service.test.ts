import { ReferralService } from '@services/referral.service';
import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';

jest.mock('@config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('ReferralService', () => {
  let service: ReferralService;

  beforeEach(() => {
    service = new ReferralService();
    jest.clearAllMocks();
  });

  describe('createReferral', () => {
    it('creates referral successfully when doctor owns the patient', async () => {
      const mockPatient = { id: 'patient-123', doctor_id: 'doc-1', full_name: 'John Doe' };
      const mockCreatedReferral = {
        id: 'ref-1',
        patient_id: 'patient-123',
        doctor_id: 'doc-1',
        reason: 'Missed two sessions',
        status: 'pending',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'patients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockPatient, error: null }),
          };
        }
        if (table === 'referrals') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockCreatedReferral, error: null }),
          };
        }
        return {};
      });

      const result = await service.createReferral('doc-1', {
        patientId: 'patient-123',
        reason: 'Missed two sessions',
      });

      expect(result).toEqual(mockCreatedReferral);
    });

    it('rejects referral with 403 when doctor does not own the patient (IDOR protection)', async () => {
      const mockPatient = { id: 'patient-123', doctor_id: 'doc-DIFFERENT', full_name: 'John Doe' };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'patients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockPatient, error: null }),
          };
        }
        return {};
      });

      await expect(
        service.createReferral('doc-ATTACKER', {
          patientId: 'patient-123',
          reason: 'Attempted cross-doctor referral',
        })
      ).rejects.toThrow(AppError);
    });

    it('rejects referral with 400 when reason is empty', async () => {
      await expect(
        service.createReferral('doc-1', {
          patientId: 'patient-123',
          reason: '   ',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('state transitions', () => {
    it('allows PSW to accept pending referral', async () => {
      const mockReferral = {
        id: 'ref-1',
        patient_id: 'patient-123',
        doctor_id: 'doc-1',
        psw_id: null,
        status: 'pending',
      };
      const mockUpdated = { ...mockReferral, status: 'accepted', psw_id: 'psw-1' };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'referrals') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockReferral, error: null }),
            update: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
          };
        }
        if (table === 'patients') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const result = await service.acceptReferral('psw-1', 'ref-1');
      expect(result.status).toBe('accepted');
      expect(result.psw_id).toBe('psw-1');
    });

    it('rejects accepting a referral that is already completed (invalid transition)', async () => {
      const mockReferral = {
        id: 'ref-1',
        patient_id: 'patient-123',
        doctor_id: 'doc-1',
        psw_id: 'psw-1',
        status: 'completed',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'referrals') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockReferral, error: null }),
          };
        }
        return {};
      });

      await expect(service.acceptReferral('psw-1', 'ref-1')).rejects.toThrow(AppError);
    });

    it('rejects starting a referral if requester is not the assigned PSW (cross-PSW IDOR)', async () => {
      const mockReferral = {
        id: 'ref-1',
        patient_id: 'patient-123',
        doctor_id: 'doc-1',
        psw_id: 'psw-LEGITIMATE',
        status: 'accepted',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'referrals') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockReferral, error: null }),
          };
        }
        return {};
      });

      await expect(service.startReferral('psw-ATTACKER', 'ref-1')).rejects.toThrow(AppError);
    });
  });

  describe('follow-up notes', () => {
    it('allows assigned PSW to record a note', async () => {
      const mockReferral = {
        id: 'ref-1',
        patient_id: 'patient-123',
        psw_id: 'psw-1',
        status: 'in_progress',
      };
      const mockNote = {
        id: 'note-1',
        referral_id: 'ref-1',
        patient_id: 'patient-123',
        psw_id: 'psw-1',
        note: 'Completed phone call with patient',
        note_type: 'call',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'referrals') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockReferral, error: null }),
          };
        }
        if (table === 'psw_notes') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockNote, error: null }),
          };
        }
        return {};
      });

      const result = await service.createReferralNote('psw-1', 'ref-1', {
        note: 'Completed phone call with patient',
        noteType: 'call',
      });

      expect(result.note).toBe('Completed phone call with patient');
      expect(result.psw_id).toBe('psw-1');
    });

    it('rejects recording note when requester is not assigned PSW', async () => {
      const mockReferral = {
        id: 'ref-1',
        patient_id: 'patient-123',
        psw_id: 'psw-ORIGINAL',
        status: 'in_progress',
      };

      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'referrals') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockReferral, error: null }),
          };
        }
        return {};
      });

      await expect(
        service.createReferralNote('psw-UNAUTHORIZED', 'ref-1', {
          note: 'Unauthorized note',
        })
      ).rejects.toThrow(AppError);
    });
  });
});
