import { FakeSupabaseClient } from '../support/fake-supabase';

const fakeClient = new FakeSupabaseClient();
jest.mock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));

import { PatientAuthService } from '@services/patient-auth.service';
import { hashCaretakerCode } from '@utils/crypto';

const validInput = {
  fullName: 'Rafeeq K',
  mobile: '9876543210',
  email: 'rafeeq@example.com',
  clinic: 'Manjeri Taluk Hospital',
};

describe('PatientAuthService.signup', () => {
  let service: PatientAuthService;

  beforeEach(() => {
    fakeClient.reset();
    fakeClient.table('patients', ['phone_number', 'email', 'public_dearpal_id']);
    service = new PatientAuthService();
  });

  it('rejects signup with a missing full name', async () => {
    await expect(service.signup({ ...validInput, fullName: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects an invalid mobile number', async () => {
    await expect(service.signup({ ...validInput, mobile: '123' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects an invalid email address', async () => {
    await expect(service.signup({ ...validInput, email: 'not-an-email' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('creates an account and returns a DearPal ID + caretaker code once', async () => {
    const result = await service.signup(validInput);

    expect(result.patient.dearPalId).toMatch(/^DP-/);
    expect(result.patient.fullName).toBe(validInput.fullName);
    expect(result.caretakerCode).toMatch(/^CG-/);
  });

  it('never persists the caretaker code in plaintext — only a hash', async () => {
    const result = await service.signup(validInput);

    const codesTable = fakeClient.table('caretaker_codes');
    const storedRow = codesTable.rows[0]!;

    expect(storedRow.code_hash).toBe(hashCaretakerCode(result.caretakerCode));
    expect(JSON.stringify(storedRow)).not.toContain(result.caretakerCode);
  });

  it('rejects a duplicate account (same mobile number)', async () => {
    await service.signup(validInput);

    await expect(
      service.signup({ ...validInput, email: 'someoneelse@example.com' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_ACCOUNT' });
  });

  it('rejects a duplicate account (same email, different mobile)', async () => {
    await service.signup(validInput);

    await expect(
      service.signup({ ...validInput, mobile: '9111111111' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_ACCOUNT' });
  });

  it('retries DearPal ID generation on a collision and still succeeds', async () => {
    jest.resetModules();
    jest.doMock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));
    jest.doMock('@utils/codes', () => {
      const actual = jest.requireActual('@utils/codes');
      let call = 0;
      return {
        ...actual,
        generatePublicDearPalId: jest.fn(() => (call++ === 0 ? 'DP-COLLIDE' : actual.generatePublicDearPalId())),
      };
    });

    const { PatientAuthService: ScopedService } = require('@services/patient-auth.service');
    const scopedFake: FakeSupabaseClient = require('@config/supabase').supabaseAdmin;
    scopedFake.table('patients').rows.push({
      id: 'existing-patient',
      public_dearpal_id: 'DP-COLLIDE',
      phone_number: '9000000000',
      email: 'someone@else.com',
    });

    const scopedService = new ScopedService();
    const result = await scopedService.signup({
      fullName: 'Second Patient',
      mobile: '9222222223',
      email: 'second@example.com',
    });

    expect(result.patient.dearPalId).not.toBe('DP-COLLIDE');

    jest.dontMock('@utils/codes');
    jest.dontMock('@config/supabase');
  });

  it('getProfileByAuthUserId never returns the caretaker code', async () => {
    const result = await service.signup({ ...validInput, mobile: '9333333334', email: 'x@y.com' });

    const patientsTable = fakeClient.table('patients');
    const row = patientsTable.rows.find((r) => r.public_dearpal_id === result.patient.dearPalId)!;

    const profile = await service.getProfileByAuthUserId(row.auth_user_id);

    expect(profile).not.toBeNull();
    expect(profile).not.toHaveProperty('caretakerCode');
    expect(JSON.stringify(profile)).not.toContain(result.caretakerCode);
  });
});
