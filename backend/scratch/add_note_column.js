const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addNoteColumn() {
    console.log('Adding note column to status_logs...');

    try {
        const { error } = await supabase.rpc('exec_sql', { 
            sql: "ALTER TABLE status_logs ADD COLUMN IF NOT EXISTS note TEXT;" 
        });

        if (error) {
            console.error('Error adding note column:', error.message);
        } else {
            console.log('Successfully added note column to status_logs table.');
        }
    } catch (err) {
        console.error('Failed to run migration:', err);
    }
}

addNoteColumn();
