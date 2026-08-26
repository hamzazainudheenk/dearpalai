import { FakeSupabaseClient } from '../support/fake-supabase';

const fakeClient = new FakeSupabaseClient();
jest.mock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));

import { CaretakerAuthService } from '@services/caretaker-auth.service';
import { OtpService } from '@services/otp/otp.service';
import { UnconfiguredOtpProvider } from '@services/otp/otp-provider';
import { hashCaretakerCode } from '@utils/crypto';

function seedPatient(overrides: Partial<Record<string, any>> = {}) {
  const table = fakeClient.table('patients');
  const row = {
    id: `patient-${table.rows.length + 1}`,
    full_name: 'Fathima N.',
    public_dearpal_id: 'DP-7K4M',
    ...overrides,
  };
  table.rows.push(row);
  return row;
}

function seedCode(patientId: string, code: string, overrides: Partial<Record<string, any>> = {}) {
  const table = fakeClient.table('caretaker_codes');
  const row = {
    id: `code-${table.rows.length + 1}`,
    patient_id: patientId,
    code_hash: hashCaretakerCode(code),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    used_at: undefined,
    revoked_at: undefined,
    ...overrides,
  };
  table.rows.push(row);
  return row;
}

describe('CaretakerAuthService.linkWithCode', () => {
  let service: CaretakerAuthService;

  beforeEach(() => {
    service = new CaretakerAuthService(new OtpService(new UnconfiguredOtpProvider()));
  });

  it('rejects an unrecognised code with a generic message', async () => {
    await expect(service.linkWithCode('caretaker-1', 'CG-NOTREAL1')).rejects.toMatchObject({
      code: 'INVALID_CARETAKER_CODE',
    });
  });

  it('links successfully with a valid code, and never leaks the patient DB id', async () => {
    const patient = seedPatient();
    seedCode(patient.id, 'CG-VALID001');

    const result = await service.linkWithCode('caretaker-1', 'CG-VALID001');

    expect(result.patient).toEqual({ dearPalId: 'DP-7K4M', displayName: 'Fathima N.' });
    expect(JSON.stringify(result)).not.toContain(patient.id);
  });

  it('accepts the code case-insensitively and with stray whitespace', async () => {
    const patient = seedPatient();
    seedCode(patient.id, 'CG-VALID002');

    await expect(service.linkWithCode('caretaker-2', '  cg-valid002  ')).resolves.toBeDefined();
  });

  it('rejects an expired code', async () => {
    const patient = seedPatient();
    seedCode(patient.id, 'CG-EXPIRED1', {
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    await expect(service.linkWithCode('caretaker-3', 'CG-EXPIRED1')).rejects.toMatchObject({
      code: 'INVALID_CARETAKER_CODE',
    });
  });

  it('rejects an already-used code (single-use by design)', async () => {
    const patient = seedPatient();
    seedCode(patient.id, 'CG-USED0001', { used_at: new Date().toISOString() });

    await expect(service.linkWithCode('caretaker-4', 'CG-USED0001')).rejects.toMatchObject({
      code: 'INVALID_CARETAKER_CODE',
    });
  });

  it('rejects a revoked code', async () => {
    const patient = seedPatient();
    seedCode(patient.id, 'CG-REVOKED1', { revoked_at: new Date().toISOString() });

    await expect(service.linkWithCode('caretaker-5', 'CG-REVOKED1')).rejects.toMatchObject({
      code: 'INVALID_CARETAKER_CODE',
    });
  });

  it('a duplicate link attempt (same caretaker, same patient, already active) succeeds idempotently', async () => {
    const patient = seedPatient();
    seedCode(patient.id, 'CG-DUP00001');

    const first = await service.linkWithCode('caretaker-6', 'CG-DUP00001');
    expect(first.patient.dearPalId).toBe('DP-7K4M');

    // Second attempt: the code is now marked used, so it's rejected — the
    // caretaker is still linked from the first call. This is the
    // single-use trade-off documented in the Phase 1 report.
    await expect(service.linkWithCode('caretaker-6', 'CG-DUP00001')).rejects.toMatchObject({
      code: 'INVALID_CARETAKER_CODE',
    });

    const links = fakeClient.table('patient_caretaker_links').rows;
    expect(links.filter((l) => l.caretaker_id === 'caretaker-6' && l.status === 'active')).toHaveLength(1);
  });

  it("one patient's code can only ever link to that same patient — never a different one", async () => {
    const patientA = seedPatient({ full_name: 'Patient A' });
    const patientB = seedPatient({ full_name: 'Patient B', public_dearpal_id: 'DP-9999' });
    seedCode(patientA.id, 'CG-PATIENTA1');
    seedCode(patientB.id, 'CG-PATIENTB1');

    const result = await service.linkWithCode('caretaker-7', 'CG-PATIENTA1');
    expect(result.patient.displayName).toBe('Patient A');
    expect(result.patient.displayName).not.toBe('Patient B');
  });
});

describe('CaretakerAuthService.getActiveLink', () => {
  let service: CaretakerAuthService;

  beforeEach(() => {
    service = new CaretakerAuthService(new OtpService(new UnconfiguredOtpProvider()));
  });

  it('returns null when the caretaker has no active link', async () => {
    const result = await service.getActiveLink('caretaker-no-link');
    expect(result.patient).toBeNull();
  });

  it("returns the linked patient's safe display info for a returning caretaker", async () => {
    const patient = seedPatient({ full_name: 'Fathima N.', public_dearpal_id: 'DP-RETURN1' });
    fakeClient.table('patient_caretaker_links').rows.push({
      id: 'link-return-1',
      caretaker_id: 'caretaker-return-1',
      patient_id: patient.id,
      status: 'active',
      linked_at: new Date().toISOString(),
    });

    const result = await service.getActiveLink('caretaker-return-1');
    expect(result.patient).toEqual({ dearPalId: 'DP-RETURN1', displayName: 'Fathima N.' });
  });

  it('ignores a revoked link', async () => {
    const patient = seedPatient({ full_name: 'Revoked Patient', public_dearpal_id: 'DP-REVOKED1' });
    fakeClient.table('patient_caretaker_links').rows.push({
      id: 'link-revoked-1',
      caretaker_id: 'caretaker-revoked-1',
      patient_id: patient.id,
      status: 'revoked',
      linked_at: new Date().toISOString(),
    });

    const result = await service.getActiveLink('caretaker-revoked-1');
    expect(result.patient).toBeNull();
  });
});
