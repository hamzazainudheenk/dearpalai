import { supabaseAdmin } from '../src/config/supabase';

async function checkTable() {
  const { data, error } = await supabaseAdmin.from('patient_todos').select('*').limit(1);
  console.log('Query patient_todos result:', { data, error });
}

checkTable().catch(console.error);
