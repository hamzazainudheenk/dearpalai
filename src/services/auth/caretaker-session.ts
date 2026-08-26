/**
 * Mints a real Supabase Auth session for a caretaker identity.
 *
 * WHY THIS FILE EXISTS: Supabase Auth's phone-based sign-in requires a
 * configured SMS provider (Twilio/MessageBird/etc.) to send its own OTP —
 * this project has none (see the Phase 1 backend audit). Rather than invent
 * a second, parallel JWT system for caretakers (explicitly out of scope —
 * Supabase Auth should be used wherever it can be), this uses a
 * well-established workaround: Supabase's *email* magic-link machinery,
 * driven entirely server-side, against a synthetic per-user email address
 * that is never actually sent anywhere.
 *
 *   1. Our own mobile-number OTP (`services/otp/*`) has already verified
 *      the caretaker owns this phone number — this function only runs
 *      after that succeeds.
 *   2. The caretaker's `auth.users` row already has a synthetic,
 *      unguessable email (`caretaker+<uuid>@caretaker.internal.dearpal`)
 *      set at creation time, in `caretaker-auth.service.ts`'s
 *      `createUser` call — never here, and never derived from the phone
 *      number (see that file's doc comment for why creation itself needs
 *      an email present, not just this session step).
 *   3. `admin.generateLink({type:'magiclink'})` asks Supabase to produce a
 *      magic-link token for that email — Supabase does NOT email it
 *      anywhere; the admin API just returns the token to us directly.
 *   4. We immediately redeem that token server-side via
 *      `auth.verifyOtp({type:'magiclink', token_hash, email})`, which
 *      returns a genuine Supabase session (`access_token`/`refresh_token`)
 *      for that user — the same kind of session a doctor gets, so the
 *      existing `authenticateDoctor`-style bearer-token pattern extends
 *      to caretakers without any new verification mechanism.
 *
 * Verified against a live Supabase project (see the Phase 1 caretaker-OTP
 * incident report) — this exact sequence (lookup → generateLink →
 * verifyOtp) works once the user already has an email set.
 */

import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export interface CaretakerSession {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

export async function mintCaretakerSession(userId: string): Promise<CaretakerSession> {
  // The synthetic email already exists on this user (set at creation) —
  // read it back rather than reconstructing/reassigning it, since it's a
  // random value, not one derived from `userId`. Never log its value.
  const { data: userLookup, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(
    userId,
  );
  const syntheticEmail = userLookup?.user?.email;

  if (lookupError || !syntheticEmail) {
    logger.error('Failed to load caretaker identity for session issuance', {
      error: lookupError?.message,
    });
    throw new AppError('Could not start caretaker session. Please try again.', 500);
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  });
  if (linkError || !linkData) {
    logger.error('Failed to generate caretaker session link', {
      error: linkError?.message,
    });
    throw new AppError('Could not start caretaker session. Please try again.', 500);
  }

  const hashedToken = linkData.properties?.hashed_token;
  if (!hashedToken) {
    logger.error('Caretaker session link response missing hashed_token');
    throw new AppError('Could not start caretaker session. Please try again.', 500);
  }

  // Supabase rejects `email` alongside `token_hash` here ("Only the
  // token_hash and type should be provided") — token_hash alone already
  // identifies the user for this exchange.
  const { data: verified, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashedToken,
  });

  if (verifyError || !verified?.session) {
    logger.error('Failed to establish caretaker session', { error: verifyError?.message });
    throw new AppError('Could not start caretaker session. Please try again.', 500);
  }

  return {
    accessToken: verified.session.access_token,
    refreshToken: verified.session.refresh_token,
    expiresAt: verified.session.expires_at,
  };
}
