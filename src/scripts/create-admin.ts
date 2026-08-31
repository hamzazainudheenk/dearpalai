import { supabaseAdmin } from '../config/supabase';
import { logger } from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'admin@dearpal.health').toLowerCase().trim();
  const password = args[1] || 'DearPal#Admin2026!';
  const fullName = args[2] || 'System Administrator';

  console.log('\n=============================================');
  console.log('  DearPal — Admin Account Provisioning Script');
  console.log('=============================================\n');
  console.log(`Target Email:     ${email}`);
  console.log(`Full Name:        ${fullName}`);
  console.log(`Password:         ${password}\n`);

  try {
    let userId: string | null = null;

    // 1. Check if auth user exists
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.error('Failed to list users from Supabase Auth:', listErr.message);
      process.exit(1);
    }

    const existingAuthUser = listData.users.find((u) => u.email?.toLowerCase() === email);

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      console.log(`Found existing Auth User ID: ${userId}`);
      // Update password & metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          full_name: fullName,
          is_active: true,
        },
      });
      console.log('Updated user credentials and metadata in Supabase Auth.');
    } else {
      // Create new Auth User
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          full_name: fullName,
          is_active: true,
        },
      });

      if (createErr || !createData.user) {
        console.error('Failed to create Auth User in Supabase:', createErr?.message);
        process.exit(1);
      }

      userId = createData.user.id;
      console.log(`Created new Auth User ID: ${userId}`);
    }

    // 2. Insert or Upsert into public.admins table
    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admins')
      .upsert({
        id: userId,
        full_name: fullName,
        email,
        is_active: true,
      })
      .select()
      .single();

    if (adminErr) {
      console.error('Failed to upsert record into public.admins table:', adminErr.message);
      console.log('NOTE: Ensure you have executed the schema update in Supabase SQL Editor to create the public.admins table.');
      process.exit(1);
    }

    console.log('\nSUCCESS! Admin account ready:');
    console.log('---------------------------------------------');
    console.log(`  Portal URL:  http://localhost:5173/admin/login`);
    console.log(`  Email:       ${email}`);
    console.log(`  Password:    ${password}`);
    console.log('---------------------------------------------\n');
  } catch (err) {
    console.error('Unexpected error creating admin:', (err as Error).message);
    process.exit(1);
  }
}

main();
