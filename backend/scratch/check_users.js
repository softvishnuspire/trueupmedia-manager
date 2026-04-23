require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
    const { data: users, error } = await supabase
        .from('users')
        .select('user_id, name, email, role, role_identifier');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('--- Users ---');
    users.forEach(user => {
        console.log(`ID: ${user.user_id}`);
        console.log(`Name: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Identifier: ${user.role_identifier}`);
        console.log('-------------------');
    });
}

checkUsers();
