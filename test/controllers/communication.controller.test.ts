import { Request, Response } from 'express';
import { CommunicationController } from '../../src/controllers/communication.controller';
import { CommunicationService } from '../../src/services/communication.service';
import { AuthenticatedRequest } from '../../src/middleware/auth.middleware';

describe('CommunicationController', () => {
  let controller: CommunicationController;
  let mockService: Partial<CommunicationService>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockService = {
      getThreads: jest.fn().mockResolvedValue([
        {
          id: 'thread-1',
          patient_id: 'pat-1',
          thread_type: 'patient_doctor',
          last_message_at: '2026-08-30T10:00:00Z',
          created_at: '2026-08-30T09:00:00Z',
          updated_at: '2026-08-30T10:00:00Z',
        },
      ]),
      getOrCreateThread: jest.fn().mockResolvedValue({
        id: 'thread-1',
        patient_id: 'pat-1',
        thread_type: 'patient_doctor',
      }),
      getThreadById: jest.fn().mockResolvedValue({
        id: 'thread-1',
        patient_id: 'pat-1',
        thread_type: 'patient_doctor',
      }),
      getThreadMessages: jest.fn().mockResolvedValue({
        messages: [{ id: 'msg-1', content: 'Hello' }],
        total: 1,
      }),
      sendMessage: jest.fn().mockResolvedValue({
        id: 'msg-1',
        content: 'Hello response',
      }),
      markThreadRead: jest.fn().mockResolvedValue({ success: true }),
    };

    controller = new CommunicationController(mockService as CommunicationService);

    mockReq = {
      doctor: {
        id: 'doc-1',
        email: 'doctor@dearpal.health',
        role: 'doctor',
        fullName: 'Dr. John',
        posting: '',
        employeeId: 'DOC-01',
        isActive: true,
      },
      query: {},
      params: {},
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('GET /api/communications/threads returns 200 with threads array', async () => {
    await controller.getThreads(mockReq as AuthenticatedRequest, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.any(Array),
      })
    );
  });

  it('POST /api/communications/threads returns 201 with created thread', async () => {
    mockReq.body = { patientId: 'pat-1', threadType: 'patient_doctor' };

    await controller.createThread(mockReq as AuthenticatedRequest, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({ id: 'thread-1' }),
      })
    );
  });

  it('GET /api/communications/threads/:threadId/messages returns 200 with messages', async () => {
    mockReq.params = { threadId: 'thread-1' };

    await controller.getThreadMessages(mockReq as AuthenticatedRequest, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.any(Array),
        total: 1,
      })
    );
  });

  it('POST /api/communications/threads/:threadId/messages returns 201 with sent message', async () => {
    mockReq.params = { threadId: 'thread-1' };
    mockReq.body = { content: 'Hello response' };

    await controller.sendMessage(mockReq as AuthenticatedRequest, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({ id: 'msg-1' }),
      })
    );
  });

  it('POST /api/communications/threads/:threadId/read returns 200', async () => {
    mockReq.params = { threadId: 'thread-1' };

    await controller.markThreadRead(mockReq as AuthenticatedRequest, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        message: 'Thread marked as read',
      })
    );
  });
});
