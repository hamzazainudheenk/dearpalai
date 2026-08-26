/**
 * `createOtpProvider` reads `config` at call time, and `config` is built
 * once from `process.env` at import time — so each scenario here resets
 * the module registry and re-imports after setting env vars, to get a
 * fresh `config` for that scenario.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe('createOtpProvider', () => {
  it('returns UnconfiguredOtpProvider when OTP_PROVIDER is unset or none', () => {
    process.env.OTP_PROVIDER = 'none';
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const { createOtpProvider, UnconfiguredOtpProvider } = require('@services/otp/otp-provider');
    expect(createOtpProvider()).toBeInstanceOf(UnconfiguredOtpProvider);
  });

  it('UnconfiguredOtpProvider.send() rejects with OTP_PROVIDER_NOT_CONFIGURED, not a fake success', async () => {
    process.env.OTP_PROVIDER = 'none';
    jest.resetModules();

    const { createOtpProvider } = require('@services/otp/otp-provider');
    const { AppError } = require('@middleware/error.middleware');

    const provider = createOtpProvider();
    await expect(provider.send('9876543210', '123456')).rejects.toThrow(AppError);
    await expect(provider.send('9876543210', '123456')).rejects.toMatchObject({
      code: 'OTP_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    });
  });

  it('returns MockOtpProvider when OTP_PROVIDER=mock and NODE_ENV is not production', () => {
    process.env.OTP_PROVIDER = 'mock';
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const { createOtpProvider, MockOtpProvider } = require('@services/otp/otp-provider');
    expect(createOtpProvider()).toBeInstanceOf(MockOtpProvider);
  });

  it('returns WhatsAppOtpProvider when OTP_PROVIDER=whatsapp', () => {
    process.env.OTP_PROVIDER = 'whatsapp';
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const { createOtpProvider, WhatsAppOtpProvider } = require('@services/otp/otp-provider');
    expect(createOtpProvider()).toBeInstanceOf(WhatsAppOtpProvider);
  });

  it('WhatsAppOtpProvider normalizes phone number and calls whatsAppService', async () => {
    const { WhatsAppOtpProvider } = require('@services/otp/otp-provider');
    const mockWhatsAppService = {
      sendTextMessage: jest.fn().mockResolvedValue({ messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'wamid.123' }] }),
    };

    const provider = new WhatsAppOtpProvider(mockWhatsAppService as any);
    await provider.send('8590873289', '123456');

    expect(mockWhatsAppService.sendTextMessage).toHaveBeenCalledWith(
      '918590873289',
      expect.stringContaining('123456'),
    );
  });
});
