import { FakeSupabaseClient } from '../support/fake-supabase';

const fakeClient = new FakeSupabaseClient();
jest.mock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));

import { authenticateChatIdentity, AuthenticatedChatRequest } from '@middleware/auth.middleware';

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function reqWithToken(token?: string): AuthenticatedChatRequest {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as AuthenticatedChatRequest;
}

describe('authenticateChatIdentity', () => {
  beforeEach(() => {
    fakeClient.reset();
    fakeClient.auth.getUser = jest.fn(async () => ({ data: { user: null }, error: { message: 'invalid' } })) as any;
  });

  it('401s with no Authorization header', async () => {
    const req = reqWithToken(undefined);
    const res = mockRes();
    const next = jest.fn();

    await authenticateChatIdentity(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on an invalid/expired token', async () => {
    const req = reqWithToken('bad-token');
    const res = mockRes();
    const next = jest.fn();

    await authenticateChatIdentity(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('resolves a patient identity and calls next()', async () => {
    fakeClient.auth.getUser = jest.fn(async () => ({ data: { user: { id: 'auth-user-1' } }, error: null })) as any;
    fakeClient.table('patients').rows.push({ id: 'patient-1', auth_user_id: 'auth-user-1', phone_number: '9876543210' });

    const req = reqWithToken('good-token');
    const res = mockRes();
    const next = jest.fn();

    await authenticateChatIdentity(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.chatIdentity).toEqual({ type: 'patient', patientId: 'patient-1', mobile: '9876543210' });
  });

  it('resolves a caretaker identity with their most recently linked active patient', async () => {
    fakeClient.auth.getUser = jest.fn(async () => ({ data: { user: { id: 'caretaker-1' } }, error: null })) as any;
    fakeClient.table('caretakers').rows.push({ id: 'caretaker-1', mobile_number: '9123456780' });
    fakeClient.table('patient_caretaker_links').rows.push({
      id: 'link-1',
      caretaker_id: 'caretaker-1',
      patient_id: 'patient-1',
      status: 'active',
      linked_at: new Date().toISOString(),
    });

    const req = reqWithToken('good-token');
    const res = mockRes();
    const next = jest.fn();

    await authenticateChatIdentity(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.chatIdentity).toEqual({
      type: 'caretaker',
      caretakerId: 'caretaker-1',
      mobile: '9123456780',
      linkedPatientId: 'patient-1',
    });
  });

  it('resolves a caretaker identity with linkedPatientId=null when there is no active link', async () => {
    fakeClient.auth.getUser = jest.fn(async () => ({ data: { user: { id: 'caretaker-2' } }, error: null })) as any;
    fakeClient.table('caretakers').rows.push({ id: 'caretaker-2', mobile_number: '9000000000' });

    const req = reqWithToken('good-token');
    const res = mockRes();
    const next = jest.fn();

    await authenticateChatIdentity(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.chatIdentity as any).linkedPatientId).toBeNull();
  });

  it('401s when the token is valid but matches neither a patient nor a caretaker', async () => {
    fakeClient.auth.getUser = jest.fn(async () => ({ data: { user: { id: 'stranger-1' } }, error: null })) as any;

    const req = reqWithToken('good-token');
    const res = mockRes();
    const next = jest.fn();

    await authenticateChatIdentity(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
