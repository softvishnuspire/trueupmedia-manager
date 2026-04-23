const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('users').select('user_id, role_identifier, role');
    if (error) {
        console.error(error);
        return;
    }
    console.log('Public Users:');
    console.table(data);
}

check();
