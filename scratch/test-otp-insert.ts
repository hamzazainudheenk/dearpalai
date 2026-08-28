import { supabaseAdmin } from '../src/config/supabase';
import { config } from '../src/config';

async function main() {
  console.log('SUPABASE URL:', config.supabase.url);
  console.log('KEY PREFIX:', config.supabase.serviceRoleKey.substring(0, 20));

  const { data, error } = await supabaseAdmin.from('otp_verifications').insert({
    mobile_number: '9778763290',
    purpose: 'caretaker_login',
    otp_hash: 'testhash123456',
    expires_at: new Date(Date.now() + 300000).toISOString(),
  }).select();

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success! Row:', data);
    if (data && data[0]?.id) {
      await supabaseAdmin.from('otp_verifications').delete().eq('id', data[0].id);
      console.log('Cleaned up test row.');
    }
  }
}

main().catch(console.error);
