const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateSchema() {
    console.log('Updating database schema...');

    const queries = [
        `ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`,
        `ALTER TABLE content_items RENAME COLUMN name TO title;`,
        `ALTER TABLE content_items ALTER COLUMN scheduled_date TYPE TIMESTAMP WITH TIME ZONE;`,
        `ALTER TABLE content_items RENAME COLUMN scheduled_date TO scheduled_datetime;`,
        `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`,
        `ALTER TABLE content_items ALTER COLUMN status SET DEFAULT 'CONTENT APPROVED';`
    ];

    for (const query of queries) {
        try {
            const { error } = await supabase.rpc('exec_sql', { sql: query });
            if (error) {
                // If RPC fails, try running it directly via a temporary function if possible
                // Or just log it. Supabase doesn't always expose exec_sql.
                console.warn(`Query failed: ${query}`, error.message);
                
                // Fallback: Many Supabase setups don't have exec_sql. 
                // We might need the user to run this in the SQL Editor.
                // However, I can try to use the REST API to run some migrations if I had a custom function.
            } else {
                console.log(`Query successful: ${query}`);
            }
        } catch (err) {
            console.error(`Error executing query: ${query}`, err);
        }
    }
}

// Since I might not have 'exec_sql' RPC, I'll provide the SQL to the user if it fails.
updateSchema();
