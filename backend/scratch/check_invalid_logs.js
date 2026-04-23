require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixOldLogs() {
    console.log('Fetching logs with non-null changed_by...');
    const { data: logs, error: logsError } = await supabase
        .from('status_logs')
        .select('log_id, changed_by')
        .not('changed_by', 'is', null);

    if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
    }

    const { data: users, error: usersError } = await supabase.from('users').select('user_id');
    if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
    }

    const validUserIds = new Set(users.map(u => u.user_id));
    
    for (const log of logs) {
        if (!validUserIds.has(log.changed_by)) {
            console.log(`Log ${log.log_id} has invalid changed_by: ${log.changed_by}. Attempting to recover...`);
            // We can't easily recover without more info, but maybe we can look at who is the TL of the client?
            // Or just leave it as null for now to avoid FK issues if we ever re-apply constraints.
        }
    }
}

fixOldLogs();
