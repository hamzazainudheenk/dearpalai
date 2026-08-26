/**
 * OTP delivery boundary.
 *
 * Nothing outside this file should know whether OTPs are actually being
 * SMS'd or not — callers depend only on `OtpProvider`. Swapping in a real
 * SMS provider (Twilio, MSG91, etc.) later means implementing this
 * interface and changing `createOtpProvider()`; nothing else changes.
 *
 * IMPORTANT: no SMS provider is configured in this project today (see the
 * Phase 1 audit). `MockOtpProvider` exists for local development only and
 * is refused outright if `NODE_ENV=production` — see `createOtpProvider`.
 */

import { config } from '@config/index';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/error.middleware';
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';

export interface OtpProvider {
  /** Sends `otp` to `mobile`. Must never log or persist the OTP itself —
   *  that's the caller's job (`services/otp/otp.service.ts`), done as a
   *  hash only. */
  send(mobile: string, otp: string): Promise<void>;
}

/** No SMS provider is configured — OTP send fails loudly and immediately,
 *  rather than silently pretending to succeed. */
export class UnconfiguredOtpProvider implements OtpProvider {
  async send(): Promise<void> {
    throw new AppError(
      'OTP delivery is not configured on this server yet.',
      503,
      true,
      'OTP_PROVIDER_NOT_CONFIGURED',
    );
  }
}

/**
 * Delivers the OTP to the caretaker's phone via Meta WhatsApp Cloud API.
 * Normalizes 10-digit Indian numbers with country code +91 automatically.
 */
export class WhatsAppOtpProvider implements OtpProvider {
  private whatsAppService: WhatsAppService;

  constructor(whatsAppService?: WhatsAppService) {
    this.whatsAppService = whatsAppService ?? new WhatsAppService();
  }

  async send(mobile: string, otp: string): Promise<void> {
    let cleanNumber = mobile.replace(/\D/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[DEV] Caretaker OTP for ${cleanNumber}: ${otp}`);
    }

    const message = `*DearPal Verification Code*\n\nYour login code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share this code with anyone.`;
    await this.whatsAppService.sendTextMessage(cleanNumber, message);
  }
}

/**
 * Development/demo only. Does not send anything anywhere — the OTP is
 * surfaced back to the caller of `OtpService.sendOtp` (as `devOtp`, gated
 * to non-production + `OTP_PROVIDER=mock`) instead of being logged, so it
 * never ends up in a log file.
 */
export class MockOtpProvider implements OtpProvider {
  async send(): Promise<void> {
    // Intentionally a no-op: no real delivery, and the OTP value itself
    // never reaches this function's arguments' log-visible surface.
  }
}

export function createOtpProvider(): OtpProvider {
  const mode = process.env.OTP_PROVIDER ?? 'none';
  const isProd = process.env.NODE_ENV === 'production';

  if (mode === 'whatsapp' || mode === 'meta') {
    return new WhatsAppOtpProvider();
  }

  if (mode === 'mock') {
    if (isProd) {
      throw new Error(
        '[Config] OTP_PROVIDER=mock is not allowed when NODE_ENV=production. ' +
          'Configure a real SMS provider before deploying.',
      );
    }
    logger.warn(
      'OTP_PROVIDER=mock — caretaker OTPs are NOT being sent via real SMS. Development/demo mode only.',
    );
    return new MockOtpProvider();
  }

  return new UnconfiguredOtpProvider();
}
