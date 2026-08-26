import { normalizeMobile, isValidMobile, isValidEmail } from '@utils/account-validators';

describe('normalizeMobile', () => {
  it('strips non-digit characters', () => {
    expect(normalizeMobile('98765 43210')).toBe('9876543210');
    expect(normalizeMobile('+91 98765-43210')).toBe('9876543210');
  });

  it('strips a leading country code of 91 when the result is still 10 digits', () => {
    expect(normalizeMobile('919876543210')).toBe('9876543210');
  });
});

describe('isValidMobile', () => {
  it('accepts a 10-digit number starting 6-9', () => {
    expect(isValidMobile('9876543210')).toBe(true);
    expect(isValidMobile('6000000000')).toBe(true);
  });

  it('rejects short, long, or badly-prefixed numbers', () => {
    expect(isValidMobile('123')).toBe(false);
    expect(isValidMobile('12345678901')).toBe(false);
    expect(isValidMobile('5876543210')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('rafeeq@example.com')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
