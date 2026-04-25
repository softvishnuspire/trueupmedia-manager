const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Starting migration...');
  
  // Adding is_rescheduled column to content_items
  const { error } = await supabase.rpc('run_sql', {
    sql: 'ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN DEFAULT FALSE;'
  });

  if (error) {
    if (error.message.includes('run_sql')) {
      console.log('\x1b[33m%s\x1b[0m', 'Note: The "run_sql" function is not enabled in your Supabase project by default.');
      console.log('Please run this SQL manually in the Supabase Dashboard (SQL Editor):');
      console.log('\nALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN DEFAULT FALSE;\n');
    } else {
      console.error('Migration failed:', error.message);
    }
  } else {
    console.log('Migration successful: is_rescheduled column added.');
  }
}

migrate();
