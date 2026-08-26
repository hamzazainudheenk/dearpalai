import { FakeSupabaseClient } from '../support/fake-supabase';

const fakeClient = new FakeSupabaseClient();
jest.mock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));

import { OtpService } from '@services/otp/otp.service';
import { OtpProvider } from '@services/otp/otp-provider';
import { AppError } from '@middleware/error.middleware';

class RecordingProvider implements OtpProvider {
  sent: Array<{ mobile: string; otp: string }> = [];
  async send(mobile: string, otp: string): Promise<void> {
    this.sent.push({ mobile, otp });
  }
}

describe('OtpService', () => {
  let provider: RecordingProvider;
  let service: OtpService;

  beforeEach(() => {
    provider = new RecordingProvider();
    service = new OtpService(provider);
  });

  it('stores only a hash of the OTP — the plaintext never reaches the database row', async () => {
    await service.sendOtp('9111111111', 'caretaker_login');
    const table = fakeClient.table('otp_verifications');
    const storedRow = table.rows[0];
    const plaintextOtp = provider.sent[0].otp;

    expect(storedRow.otp_hash).toBeDefined();
    expect(storedRow).not.toHaveProperty('otp');
    expect(JSON.stringify(storedRow)).not.toContain(plaintextOtp);
  });

  it('rejects an empty/never-requested OTP with a generic error', async () => {
    await expect(service.verifyOtp('9222222222', '000000', 'caretaker_login')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('verifies the correct OTP successfully', async () => {
    await service.sendOtp('9333333333', 'caretaker_login');
    const otp = provider.sent[0].otp;
    await expect(service.verifyOtp('9333333333', otp, 'caretaker_login')).resolves.toBeUndefined();
  });

  it('rejects an incorrect OTP with a generic error, without revealing the real one', async () => {
    await service.sendOtp('9444444444', 'caretaker_login');
    await expect(
      service.verifyOtp('9444444444', '000000', 'caretaker_login'),
    ).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('rejects a used-up OTP on a second verify attempt (one-time verification)', async () => {
    await service.sendOtp('9555555555', 'caretaker_login');
    const otp = provider.sent[0].otp;
    await service.verifyOtp('9555555555', otp, 'caretaker_login');
    await expect(service.verifyOtp('9555555555', otp, 'caretaker_login')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('rejects an expired OTP', async () => {
    await service.sendOtp('9666666666', 'caretaker_login');
    const otp = provider.sent.find((s) => s.mobile === '9666666666')!.otp;
    const table = fakeClient.table('otp_verifications');
    const row = table.rows.find((r) => r.mobile_number === '9666666666')!;
    row.expires_at = new Date(Date.now() - 1000).toISOString();

    await expect(service.verifyOtp('9666666666', otp, 'caretaker_login')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('locks out after the maximum number of wrong attempts, even before expiry', async () => {
    await service.sendOtp('9777777777', 'caretaker_login');
    const otp = provider.sent[0].otp;

    for (let i = 0; i < 5; i++) {
      await expect(
        service.verifyOtp('9777777777', '000000', 'caretaker_login'),
      ).rejects.toMatchObject({ code: 'INVALID_OTP' });
    }

    // Even the CORRECT otp is now rejected — attempts are exhausted.
    await expect(service.verifyOtp('9777777777', otp, 'caretaker_login')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('enforces a resend cooldown', async () => {
    await service.sendOtp('9888888888', 'caretaker_login');
    await expect(service.sendOtp('9888888888', 'caretaker_login')).rejects.toMatchObject({
      code: 'OTP_RESEND_COOLDOWN',
    });
  });

  it('allows resend for a different mobile number immediately (cooldown is per-mobile)', async () => {
    await service.sendOtp('9999999991', 'caretaker_login');
    await expect(service.sendOtp('9999999992', 'caretaker_login')).resolves.toBeDefined();
  });
});
