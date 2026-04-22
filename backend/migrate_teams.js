const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Running migration...');

    // Add team_lead_id column to clients
    // We try to use RPC if available, but if not, we might have to ask the user.
    // However, I can also try to insert a new TL user first.
    
    const { data: tl2, error: tlError } = await supabase.from('users').upsert([
        { 
            name: 'Sarah Team Lead', 
            email: 'sarah.tl@trueupmedia.com', 
            password_hash: 'Sarah@123', 
            role: 'TL2' 
        }
    ], { onConflict: 'email' }).select();

    if (tlError) console.error('Error seeding TL2:', tlError);
    else console.log('Seeded TL2:', tl2);

    // Note: ALTER TABLE usually requires higher privileges than what standard RPC might allow 
    // depending on how it's set up. 
    // I will try to run it via RPC if it exists.
    const { error: rpcError } = await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES users(user_id);' 
    });

    if (rpcError) {
        console.warn('RPC exec_sql failed. You may need to run this manually in Supabase SQL Editor:', 
            'ALTER TABLE clients ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES users(user_id);');
    } else {
        console.log('Successfully added team_lead_id column.');
    }
}

migrate();
