import { hashCaretakerCode, hashOtp, timingSafeEqualHex } from '@utils/crypto';

describe('hashCaretakerCode', () => {
  it('is deterministic for the same input', () => {
    expect(hashCaretakerCode('CG-7K4MQ92X')).toBe(hashCaretakerCode('CG-7K4MQ92X'));
  });

  it('normalizes case and whitespace before hashing, so a pasted code still matches', () => {
    expect(hashCaretakerCode('cg-7k4mq92x')).toBe(hashCaretakerCode('CG-7K4MQ92X'));
    expect(hashCaretakerCode('  CG-7K4MQ92X  ')).toBe(hashCaretakerCode('CG-7K4MQ92X'));
  });

  it('produces different hashes for different codes', () => {
    expect(hashCaretakerCode('CG-7K4MQ92X')).not.toBe(hashCaretakerCode('CG-DIFFERENT'));
  });

  it('never returns the plaintext code itself', () => {
    const hash = hashCaretakerCode('CG-7K4MQ92X');
    expect(hash).not.toContain('CG-7K4MQ92X');
  });
});

describe('hashOtp', () => {
  it('is deterministic and never echoes the plaintext OTP', () => {
    const hash = hashOtp('123456');
    expect(hash).toBe(hashOtp('123456'));
    expect(hash).not.toContain('123456');
  });
});

describe('timingSafeEqualHex', () => {
  it('returns true for identical hex digests', () => {
    const hash = hashOtp('123456');
    expect(timingSafeEqualHex(hash, hash)).toBe(true);
  });

  it('returns false for different hex digests', () => {
    expect(timingSafeEqualHex(hashOtp('123456'), hashOtp('654321'))).toBe(false);
  });

  it('returns false (not throws) for mismatched lengths', () => {
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
  });
});
