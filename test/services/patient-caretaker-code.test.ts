import { PatientAuthService } from '@services/patient-auth.service';
import { CaretakerAuthService } from '@services/caretaker-auth.service';
import { OtpService } from '@services/otp/otp.service';
import { MockOtpProvider } from '@services/otp/otp-provider';
import { FakeSupabaseClient } from '../support/fake-supabase';
import {
  encryptCaretakerCode,
  decryptCaretakerCode,
  hashCaretakerCode,
} from '@utils/crypto';

let fakeClient: FakeSupabaseClient;

jest.mock('@config/supabase', () => ({
  get supabaseAdmin() {
    return fakeClient;
  },
}));

describe('Patient Caretaker Code Security & Lifecycle', () => {
  let patientAuthService: PatientAuthService;
  let caretakerAuthService: CaretakerAuthService;

  beforeEach(() => {
    fakeClient = new FakeSupabaseClient();
    fakeClient.table('patients', ['phone_number', 'email', 'public_dearpal_id']);
    fakeClient.table('caretaker_codes', ['code_hash']);
    fakeClient.table('patient_caretaker_links');
    patientAuthService = new PatientAuthService();
    caretakerAuthService = new CaretakerAuthService(new OtpService(new MockOtpProvider()));
  });

  describe('AES-256-GCM Crypto Unit Tests', () => {
    it('encrypts and decrypts caretaker code round-trip successfully', () => {
      const code = 'CG-7K4MQ92X';
      const ciphertext = encryptCaretakerCode(code);
      expect(ciphertext).not.toEqual(code);
      expect(ciphertext.split(':')).toHaveLength(3); // iv:authTag:encrypted

      const decrypted = decryptCaretakerCode(ciphertext);
      expect(decrypted).toBe(code);
    });

    it('fails safely with null on wrong encryption key or corrupted ciphertext', () => {
      const code = 'CG-7K4MQ92X';
      const ciphertext = encryptCaretakerCode(code, 'key-alpha-12345678901234567890123456');

      // Decrypt with different key
      const failed = decryptCaretakerCode(ciphertext, 'key-beta-98765432109876543210987654');
      expect(failed).toBeNull();

      // Decrypt corrupted ciphertext
      const parts = ciphertext.split(':');
      const corrupted = `${parts[0]}:${parts[1]}:badhexdata`;
      expect(decryptCaretakerCode(corrupted)).toBeNull();
      expect(decryptCaretakerCode('')).toBeNull();
      expect(decryptCaretakerCode('invalid')).toBeNull();
    });
  });

  describe('Patient Active Caretaker Code Retrieval', () => {
    it('retrieves active unlinked caretaker code for authenticated patient', async () => {
      // 1. Signup patient
      const signup = await patientAuthService.signup({
        fullName: 'Ananya Nair',
        mobile: '9876543210',
        email: 'ananya@example.com',
      });

      const dearpalId = signup.patient.dearPalId;
      const initialCode = signup.caretakerCode;

      // 2. Retrieve active code via getActiveCaretakerCode
      const result = await patientAuthService.getActiveCaretakerCode(dearpalId);
      expect(result.status).toBe('active');
      expect(result.code).toBe(initialCode);
      expect(result.isLinked).toBe(false);
      expect(result.expiresAt).toBeDefined();

      // Opening repeatedly returns the SAME code
      const result2 = await patientAuthService.getActiveCaretakerCode(dearpalId);
      expect(result2.code).toBe(initialCode);
      expect(result2.status).toBe('active');
    });

    it('enforces patient isolation: Patient A cannot see Patient B code', async () => {
      const patientA = await patientAuthService.signup({
        fullName: 'Patient A',
        mobile: '9876500001',
        email: 'patienta@example.com',
      });

      const patientB = await patientAuthService.signup({
        fullName: 'Patient B',
        mobile: '9876500002',
        email: 'patientb@example.com',
      });

      const codeA = await patientAuthService.getActiveCaretakerCode(patientA.patient.dearPalId);
      const codeB = await patientAuthService.getActiveCaretakerCode(patientB.patient.dearPalId);

      expect(codeA.code).toBe(patientA.caretakerCode);
      expect(codeB.code).toBe(patientB.caretakerCode);
      expect(codeA.code).not.toBe(codeB.code);
    });

    it('returns linked state (no plaintext) once a caretaker has linked', async () => {
      const signup = await patientAuthService.signup({
        fullName: 'Ramesh Kumar',
        mobile: '9876543211',
        email: 'ramesh@example.com',
      });

      const patientId = fakeClient.table('patients').rows[0].id;

      // Caretaker links using the code
      await caretakerAuthService.linkWithCode('caretaker-user-1', signup.caretakerCode);

      // Now patient checks caretaker code
      const result = await patientAuthService.getActiveCaretakerCode(signup.patient.dearPalId);
      expect(result.status).toBe('linked');
      expect(result.code).toBeNull();
      expect(result.isLinked).toBe(true);
      expect(result.linkedAt).toBeDefined();
    });

    it('returns expired state if the code has passed expiry', async () => {
      const signup = await patientAuthService.signup({
        fullName: 'Deepa V',
        mobile: '9876543212',
        email: 'deepa@example.com',
      });

      // Manually backdate expires_at
      const codeRow = fakeClient.table('caretaker_codes').rows[0];
      codeRow.expires_at = new Date(Date.now() - 1000 * 60).toISOString();

      const result = await patientAuthService.getActiveCaretakerCode(signup.patient.dearPalId);
      expect(result.status).toBe('expired');
      expect(result.code).toBeNull();
      expect(result.isLinked).toBe(false);
    });

    it('returns expired state for legacy rows without code_encrypted (never fabricates value)', async () => {
      const signup = await patientAuthService.signup({
        fullName: 'Legacy User',
        mobile: '9876543213',
        email: 'legacy@example.com',
      });

      // Strip code_encrypted to simulate legacy record
      const codeRow = fakeClient.table('caretaker_codes').rows[0];
      delete codeRow.code_encrypted;

      const result = await patientAuthService.getActiveCaretakerCode(signup.patient.dearPalId);
      expect(result.status).toBe('expired');
      expect(result.code).toBeNull();
      expect(result.isLinked).toBe(false);
    });
  });

  describe('Patient Caretaker Code Refresh / Regeneration', () => {
    it('refreshes caretaker code: revokes old code and issues a new active code', async () => {
      const signup = await patientAuthService.signup({
        fullName: 'Suresh Babu',
        mobile: '9876543214',
        email: 'suresh@example.com',
      });

      const oldCode = signup.caretakerCode;

      // Patient refreshes code
      const refreshResult = await patientAuthService.refreshCaretakerCode(signup.patient.dearPalId);
      expect(refreshResult.status).toBe('active');
      expect(refreshResult.code).toBeDefined();
      expect(refreshResult.code).not.toBe(oldCode);

      // Old code is now revoked and rejected if caretaker tries to link
      await expect(
        caretakerAuthService.linkWithCode('caretaker-user-2', oldCode),
      ).rejects.toThrow('The code is invalid or no longer available.');

      // New refreshed code links successfully
      const linkResult = await caretakerAuthService.linkWithCode(
        'caretaker-user-2',
        refreshResult.code!,
      );
      expect(linkResult.patient.displayName).toBe('Suresh Babu');

      // After linking, code is marked linked
      const afterLink = await patientAuthService.getActiveCaretakerCode(signup.patient.dearPalId);
      expect(afterLink.status).toBe('linked');
      expect(afterLink.isLinked).toBe(true);
    });
  });
});
