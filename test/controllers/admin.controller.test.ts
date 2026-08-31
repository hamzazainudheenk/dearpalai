import { AdminController } from '@controllers/admin.controller';
import { AdminService } from '@services/admin.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('AdminController', () => {
  let controller: AdminController;
  let service: jest.Mocked<AdminService>;

  beforeEach(() => {
    service = {
      getDashboardStats: jest.fn(),
      getProfessionals: jest.fn(),
      getProfessionalById: jest.fn(),
      createProfessional: jest.fn(),
      updateProfessional: jest.fn(),
      setProfessionalStatus: jest.fn(),
      resetProfessionalPassword: jest.fn(),
    } as unknown as jest.Mocked<AdminService>;

    controller = new AdminController(service);
  });

  describe('getDashboardStats', () => {
    it('returns 200 with dashboard stats', async () => {
      const mockStats = { professionals: { total: 5 } } as any;
      service.getDashboardStats.mockResolvedValue(mockStats);

      const req = {
        professional: { id: 'admin-1', email: 'admin@clinic.com', role: 'admin' },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.getDashboardStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockStats });
    });
  });

  describe('createProfessional', () => {
    it('returns 201 when admin creates new professional', async () => {
      const mockCreated = { id: 'doc-1', full_name: 'Dr. Sarah', role: 'doctor' } as any;
      service.createProfessional.mockResolvedValue(mockCreated);

      const req = {
        professional: { id: 'admin-1', email: 'admin@clinic.com', role: 'admin' },
        body: {
          role: 'doctor',
          fullName: 'Dr. Sarah',
          email: 'sarah@clinic.com',
        },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.createProfessional(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockCreated });
    });
  });

  describe('deactivateProfessional', () => {
    it('returns 200 when admin deactivates professional', async () => {
      const mockUpdated = { id: 'doc-1', is_active: false } as any;
      service.setProfessionalStatus.mockResolvedValue(mockUpdated);

      const req = {
        professional: { id: 'admin-1', email: 'admin@clinic.com', role: 'admin' },
        params: { id: 'doc-1' },
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      await controller.deactivateProfessional(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockUpdated });
    });
  });
});
