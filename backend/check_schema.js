const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    // Try fetching all columns from clients
    const { data: clients, error: cErr } = await supabase.from('clients').select('*').limit(2);
    console.log('=== CLIENTS ===');
    if (cErr) console.log('Error:', cErr.message);
    else {
        console.log('Columns:', clients.length > 0 ? Object.keys(clients[0]) : 'No rows');
        console.log('Sample:', JSON.stringify(clients[0], null, 2));
    }

    // Try fetching all columns from content_items
    const { data: items, error: iErr } = await supabase.from('content_items').select('*').limit(2);
    console.log('\n=== CONTENT_ITEMS ===');
    if (iErr) console.log('Error:', iErr.message);
    else {
        console.log('Columns:', items.length > 0 ? Object.keys(items[0]) : 'No rows');
        console.log('Sample:', JSON.stringify(items[0], null, 2));
    }
}

check();
