require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'status_logs' });
    
    if (error) {
        console.log('Error calling RPC:', error.message);
        // Fallback: try to select one row
        const { data: row } = await supabase.from('status_logs').select('*').limit(1);
        if (row && row.length > 0) {
            console.log('Columns in status_logs:', Object.keys(row[0]));
        } else {
            console.log('No rows in status_logs to check columns.');
        }
    } else {
        console.log('Table Info:', data);
    }
}

checkSchema();
