require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkNote() {
    const { data, error } = await supabase.from('status_logs').select('note').limit(1);
    if (error) {
        console.log('Error selecting note:', error.message);
    } else {
        console.log('Note column exists. Data:', data);
    }
}

checkNote();
