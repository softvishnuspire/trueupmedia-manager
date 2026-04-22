const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) console.error(error);
    else console.log('Users:', users);
}

check();
