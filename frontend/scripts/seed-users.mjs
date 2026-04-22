/**
 * Seed script: Creates test users in Supabase Auth for each role
 * and creates a `user_roles` table to map users to their roles.
 *
 * Run with: node scripts/seed-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hjikmcyzqowdiammndrs.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_ONXr9E7ywzHjOw98g0VVoQ_7jLSMBek';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
  { email: 'admin@trueupmedia.com',  password: 'Admin@123',  role: 'Admin', name: 'Admin User' },
  { email: 'coo@trueupmedia.com',    password: 'Coo@123',    role: 'COO',   name: 'COO User' },
  { email: 'gm@trueupmedia.com',     password: 'Gm@123',     role: 'GM',    name: 'General Manager' },
  { email: 'tl@trueupmedia.com',     password: 'Tl@123',     role: 'TL1',   name: 'Team Lead' }, // Using TL1 to match existing Enum
];

async function seedUsers() {
  console.log('🚀 Starting user seed...\n');

  for (const user of users) {
    console.log(`👤 Creating user: ${user.email} (role: ${user.role})`);

    // 1. Create in Supabase Auth (auth.users)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === user.email);

    let authUserId;

    if (existingUser) {
      console.log(`   ⏭️  Auth user already exists (${existingUser.id})`);
      authUserId = existingUser.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.name, role: user.role.toLowerCase() }
      });

      if (error) {
        console.log(`   ❌ Auth Error: ${error.message}`);
        continue;
      }
      authUserId = data.user.id;
      console.log(`   ✅ Auth user created (${authUserId})`);
    }

    // 2. Insert into custom public.users table
    // We pass authUserId as user_id so it links correctly.
    const { error: dbError } = await supabase
      .from('users')
      .upsert({ 
        user_id: authUserId,
        name: user.name,
        email: user.email,
        password_hash: user.password, // Storing dummy/plaintext since user schema expects it
        role: user.role 
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.log(`   ⚠️  DB insert failed: ${dbError.message}`);
    } else {
      console.log(`   ✅ DB user mapped in public.users`);
    }
    console.log('');
  }

  console.log('─'.repeat(50));
  console.log('🎉 Seed complete! Here are the test credentials:\n');
  console.log('Role            │ Email                      │ Password');
  console.log('────────────────┼────────────────────────────┼──────────');
  for (const u of users) {
    console.log(`${u.role.padEnd(16)}│ ${u.email.padEnd(27)}│ ${u.password}`);
  }
  console.log('');
}

seedUsers().catch(console.error);
