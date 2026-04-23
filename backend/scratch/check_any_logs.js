require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAllLogs() {
    const { data, error } = await supabase
        .from('status_logs')
        .select('changed_by')
        .not('changed_by', 'is', null);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} logs with changed_by set.`);
    if (data.length > 0) {
        console.log('Sample changed_by values:', data.slice(0, 5).map(l => l.changed_by));
    }
}

checkAllLogs();
