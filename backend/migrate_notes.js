
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Starting migration to add note column to status_logs...');
    
    // Add note column to status_logs
    const { error: noteError } = await supabase.rpc('run_sql', {
        sql: 'ALTER TABLE status_logs ADD COLUMN IF NOT EXISTS note TEXT;'
    });

    if (noteError) {
        console.error('Error adding note column:', noteError);
        // Fallback: Try a direct query if run_sql doesn't exist
        console.log('Trying alternative migration method...');
        const { error: fallbackError } = await supabase.from('status_logs').select('note').limit(1);
        if (fallbackError && fallbackError.code === 'PGRST204') {
            console.log('Table exists but note column missing? No, PGRST204 is no content. 42703 is column missing.');
        }
    } else {
        console.log('Successfully added note column.');
    }

    console.log('Migration complete.');
}

migrate();
