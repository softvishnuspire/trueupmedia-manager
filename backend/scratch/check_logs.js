require('dotenv').config();
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
        .order('changed_at', { ascending: false });

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log('--- Status Logs ---');
    logs.forEach(log => {
        console.log(`ID: ${log.log_id}`);
        console.log(`Item ID: ${log.item_id}`);
        console.log(`Status: ${log.old_status} -> ${log.new_status}`);
        console.log(`Note: ${log.note}`);
        console.log(`Changed By: ${log.users?.role_identifier || 'Unknown'}`);
        console.log(`At: ${log.changed_at}`);
        console.log('-------------------');
    });
}

checkLogs();
