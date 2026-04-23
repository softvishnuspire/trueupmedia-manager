const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkClients() {
    const { data: clients, error: clientError } = await supabase.from('clients').select('*');
    if (clientError) {
        console.error('Client Error:', clientError);
        return;
    }
    console.log('Clients:', clients.map(c => ({ 
        id: c.id, 
        company_name: c.company_name, 
        team_lead_id: c.team_lead_id,
        is_active: c.is_active,
        is_deleted: c.is_deleted
    })));

    const { data: users, error: userError } = await supabase.from('users').select('*');
    if (userError) {
        console.error('User Error:', userError);
        return;
    }
    console.log('Users:', users.map(u => ({ user_id: u.user_id, name: u.name, role: u.role })));
}

checkClients();
