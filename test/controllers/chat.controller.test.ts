import { ChatController } from '@controllers/chat.controller';
import { ChatService } from '@services/chat.service';
import { AuthenticatedChatRequest, ChatIdentity } from '@middleware/auth.middleware';
import { AppError } from '@middleware/error.middleware';

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const patientIdentity: ChatIdentity = { type: 'patient', patientId: 'patient-1', mobile: '9876543210' };
const caretakerIdentity: ChatIdentity = {
  type: 'caretaker',
  caretakerId: 'caretaker-1',
  mobile: '9123456780',
  linkedPatientId: 'patient-1',
};

describe('ChatController.message', () => {
  it('401s when no chatIdentity is attached (should not happen behind the middleware, but never trust it silently)', async () => {
    const chatService = { sendMessage: jest.fn() } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = { body: { message: 'hi', conversationScope: 'patient' } } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('400s on a missing message', async () => {
    const chatService = { sendMessage: jest.fn() } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = { chatIdentity: patientIdentity, body: { conversationScope: 'patient' } } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400s on an invalid conversationScope value', async () => {
    const chatService = { sendMessage: jest.fn() } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = {
      chatIdentity: patientIdentity,
      body: { message: 'hi', conversationScope: 'doctor' },
    } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('403s when a patient token is used with conversationScope=caretaker (wrong role for requested scope)', async () => {
    const chatService = { sendMessage: jest.fn() } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = {
      chatIdentity: patientIdentity,
      body: { message: 'hi', conversationScope: 'caretaker' },
    } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('403s when a caretaker token is used with conversationScope=patient', async () => {
    const chatService = { sendMessage: jest.fn() } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = {
      chatIdentity: caretakerIdentity,
      body: { message: 'hi', conversationScope: 'patient' },
    } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('200s and returns the reply on a valid matching-scope request', async () => {
    const chatService = { sendMessage: jest.fn(async () => ({ reply: 'Hello there.' })) } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = {
      chatIdentity: patientIdentity,
      body: { message: 'hi', conversationScope: 'patient' },
    } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { reply: 'Hello there.' } });
  });

  it('never leaks internal error details — only AppError.message and .code reach the client', async () => {
    const chatService = {
      sendMessage: jest.fn(async () => {
        throw new AppError('Dear Pal is having trouble responding right now. Please try again in a moment.', 502, true, 'AI_UNAVAILABLE');
      }),
    } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = {
      chatIdentity: patientIdentity,
      body: { message: 'hi', conversationScope: 'patient' },
    } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      code: 'AI_UNAVAILABLE',
      message: 'Dear Pal is having trouble responding right now. Please try again in a moment.',
    });
  });

  it('an unexpected non-AppError throw is mapped to a generic 500 with no internal detail', async () => {
    const chatService = {
      sendMessage: jest.fn(async () => {
        throw new Error('supabase connection string: postgres://user:secret@host/db');
      }),
    } as unknown as ChatService;
    const controller = new ChatController(chatService);
    const req = {
      chatIdentity: patientIdentity,
      body: { message: 'hi', conversationScope: 'patient' },
    } as AuthenticatedChatRequest;
    const res = mockRes();

    await controller.message(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Internal server error' });
  });
});
