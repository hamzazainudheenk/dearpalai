import {
  generatePublicDearPalId,
  generateCaretakerCode,
  generateNumericOtp,
} from '@utils/codes';

describe('generatePublicDearPalId', () => {
  it('matches the DP-XXXX format using only the safe alphabet', () => {
    const id = generatePublicDearPalId();
    expect(id).toMatch(/^DP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it('excludes visually ambiguous characters (0, O, 1, I, L)', () => {
    for (let i = 0; i < 200; i++) {
      const id = generatePublicDearPalId();
      expect(id).not.toMatch(/[01OIL]/);
    }
  });

  it('is not sequential — 100 generations are all different', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePublicDearPalId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateCaretakerCode', () => {
  it('matches the CG-XXXXXXXX format and is a different shape from the DearPal ID', () => {
    const code = generateCaretakerCode();
    expect(code).toMatch(/^CG-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('is high-entropy — 200 generations are all different', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateCaretakerCode()));
    expect(codes.size).toBe(200);
  });
});

describe('generateNumericOtp', () => {
  it('is always exactly 6 digits, zero-padded', () => {
    for (let i = 0; i < 200; i++) {
      const otp = generateNumericOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });
});
