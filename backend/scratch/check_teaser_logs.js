require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkItemLogs() {
    const { data: item } = await supabase
        .from('content_items')
        .select('id')
        .eq('title', 'Product Launch Teaser')
        .single();

    if (!item) {
        console.log('Item not found');
        return;
    }

    const { data: logs, error } = await supabase
        .from('status_logs')
        .select('*')
        .eq('item_id', item.id)
        .order('changed_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Logs for Product Launch Teaser (${item.id}):`);
    console.log(JSON.stringify(logs, null, 2));
}

checkItemLogs();
