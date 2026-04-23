require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
    const { data: logs, error } = await supabase
        .from('status_logs')
        .select(`
            *,
            users:changed_by (
                name,
                role_identifier
            )
        `)
        .order('changed_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Latest Status Logs:');
    console.log(JSON.stringify(logs, null, 2));
}

checkLogs();
