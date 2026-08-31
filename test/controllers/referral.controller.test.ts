import { ReferralController } from '@controllers/referral.controller';
import { ReferralService } from '@services/referral.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { AppError } from '@middleware/error.middleware';

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('ReferralController', () => {
  let controller: ReferralController;
  let service: jest.Mocked<ReferralService>;

  beforeEach(() => {
    service = {
      createReferral: jest.fn(),
      getPatientReferrals: jest.fn(),
      getPswReferrals: jest.fn(),
      getReferralById: jest.fn(),
      acceptReferral: jest.fn(),
      startReferral: jest.fn(),
      completeReferral: jest.fn(),
      getReferralNotes: jest.fn(),
      createReferralNote: jest.fn(),
      getAvailablePsws: jest.fn(),
    } as unknown as jest.Mocked<ReferralService>;

    controller = new ReferralController(service);
  });

  describe('createReferral', () => {
    it('returns 201 on valid referral creation by Doctor', async () => {
      const mockResult = { id: 'ref-1', patient_id: 'p-1', status: 'pending' } as any;
      service.createReferral.mockResolvedValue(mockResult);

      const req = {
        professional: { id: 'doc-1', email: 'doc@clinic.com', role: 'doctor' },
        body: { patientId: 'p-1', reason: 'Follow up required' },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.createReferral(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockResult });
    });

    it('returns 403 if requester role is not doctor or admin', async () => {
      const req = {
        professional: { id: 'psw-1', email: 'psw@clinic.com', role: 'psw' },
        body: { patientId: 'p-1', reason: 'Follow up' },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.createReferral(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(service.createReferral).not.toHaveBeenCalled();
    });
  });

  describe('acceptReferral', () => {
    it('returns 200 on valid referral acceptance by PSW', async () => {
      const mockResult = { id: 'ref-1', status: 'accepted', psw_id: 'psw-1' } as any;
      service.acceptReferral.mockResolvedValue(mockResult);

      const req = {
        professional: { id: 'psw-1', email: 'psw@clinic.com', role: 'psw' },
        params: { id: 'ref-1' },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.acceptReferral(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockResult });
    });

    it('returns 403 if requester role is not psw or admin', async () => {
      const req = {
        professional: { id: 'doc-1', email: 'doc@clinic.com', role: 'doctor' },
        params: { id: 'ref-1' },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.acceptReferral(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(service.acceptReferral).not.toHaveBeenCalled();
    });
  });
});
