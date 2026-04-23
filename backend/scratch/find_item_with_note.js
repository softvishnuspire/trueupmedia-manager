require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findItemWithNote() {
    const { data: logs, error } = await supabase
        .from('status_logs')
        .select('item_id, note, changed_at')
        .not('note', 'is', null)
        .order('changed_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    console.log('Logs with notes:');
    console.log(JSON.stringify(logs, null, 2));

    if (logs.length > 0) {
        const { data: item } = await supabase
            .from('content_items')
            .select('title')
            .eq('id', logs[0].item_id)
            .single();
        console.log('Item Title:', item?.title);
    }
}

findItemWithNote();
