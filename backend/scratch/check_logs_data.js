require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
    const { data, error } = await supabase
        .from('status_logs')
        .select(`
            *,
            users!status_logs_changed_by_fkey (
                role_identifier,
                name
            )
        `)
        .order('changed_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Last 5 Status Logs:');
    console.log(JSON.stringify(data, null, 2));
}

checkLogs();
