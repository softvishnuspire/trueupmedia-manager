require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const { data: publicUsers, error: publicError } = await supabase.from('users').select('*');

    if (authError || publicError) {
        console.error('Error:', authError || publicError);
        return;
    }

    console.log('Auth Users (Sample):');
    console.log(authUsers.users.slice(0, 2).map(u => ({ id: u.id, email: u.email })));

    console.log('Public Users (Sample):');
    console.log(publicUsers.slice(0, 2).map(u => ({ user_id: u.user_id, email: u.email, role_identifier: u.role_identifier })));
}

checkUsers();
