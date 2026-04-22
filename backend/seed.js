const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    console.log('Seeding data...\n');

    // 1. Insert clients
    const { data: clients, error: cErr } = await supabase
        .from('clients')
        .upsert([
            { company_name: 'Aero Dynamics', is_active: true, is_deleted: false },
            { company_name: 'Pulse Media Group', is_active: true, is_deleted: false },
            { company_name: 'Zenith Solutions', is_active: true, is_deleted: false },
            { company_name: 'Lumina Creative', is_active: true, is_deleted: false },
            { company_name: 'Nova Digital', is_active: true, is_deleted: false },
            { company_name: 'Horizon Labs', is_active: true, is_deleted: false },
        ], { onConflict: 'company_name' })
        .select('id, company_name');

    if (cErr) { console.error('Client insert error:', cErr.message); return; }
    console.log(`✓ ${clients.length} clients ready`);

    // Build a lookup map
    const lookup = {};
    clients.forEach(c => lookup[c.company_name] = c.id);

    // 2. Insert content items for April & May 2026
    const items = [
        // Aero Dynamics
        { client_id: lookup['Aero Dynamics'], title: 'Product Launch Teaser', content_type: 'Post', scheduled_datetime: '2026-04-24T10:00:00', status: 'CONTENT APPROVED' },
        { client_id: lookup['Aero Dynamics'], title: 'Weekly Reel #1', content_type: 'Reel', scheduled_datetime: '2026-04-25T18:00:00', status: 'CONTENT READY' },
        { client_id: lookup['Aero Dynamics'], title: 'Behind the Brand', content_type: 'Post', scheduled_datetime: '2026-04-28T09:00:00', status: 'DESIGNING IN PROGRESS' },
        // Pulse Media Group
        { client_id: lookup['Pulse Media Group'], title: 'Client Testimonial', content_type: 'Post', scheduled_datetime: '2026-04-23T09:00:00', status: 'CONTENT APPROVED' },
        { client_id: lookup['Pulse Media Group'], title: 'Office Tour Reel', content_type: 'Reel', scheduled_datetime: '2026-04-26T14:00:00', status: 'SHOOT DONE' },
        // Zenith Solutions
        { client_id: lookup['Zenith Solutions'], title: 'Infographic Post', content_type: 'Post', scheduled_datetime: '2026-04-22T11:00:00', status: 'WAITING FOR APPROVAL' },
        { client_id: lookup['Zenith Solutions'], title: 'Product Demo Reel', content_type: 'Reel', scheduled_datetime: '2026-04-27T15:00:00', status: 'EDITING IN PROGRESS' },
        // Lumina Creative
        { client_id: lookup['Lumina Creative'], title: 'Morning Motivation', content_type: 'Post', scheduled_datetime: '2026-04-24T08:30:00', status: 'APPROVED' },
        { client_id: lookup['Lumina Creative'], title: 'BTS Photography', content_type: 'Reel', scheduled_datetime: '2026-04-29T16:00:00', status: 'CONTENT READY' },
        // Nova Digital
        { client_id: lookup['Nova Digital'], title: 'App Launch Announcement', content_type: 'Post', scheduled_datetime: '2026-04-25T10:00:00', status: 'CONTENT APPROVED' },
        { client_id: lookup['Nova Digital'], title: 'Feature Walkthrough', content_type: 'Reel', scheduled_datetime: '2026-04-30T12:00:00', status: 'CONTENT READY' },
        // Horizon Labs
        { client_id: lookup['Horizon Labs'], title: 'Research Highlights', content_type: 'Post', scheduled_datetime: '2026-04-23T13:00:00', status: 'DESIGNING COMPLETED' },
        { client_id: lookup['Horizon Labs'], title: 'Lab Tour', content_type: 'Reel', scheduled_datetime: '2026-04-28T17:00:00', status: 'SHOOT DONE' },
    ];

    const { data: inserted, error: iErr } = await supabase
        .from('content_items')
        .insert(items)
        .select('id, title');

    if (iErr) { console.error('Content insert error:', iErr.message); return; }
    console.log(`✓ ${inserted.length} content items created\n`);

    // Print summary
    console.log('── Summary ──');
    clients.forEach(c => {
        const count = items.filter(i => i.client_id === c.id).length;
        console.log(`  ${c.company_name}: ${count} items`);
    });
    console.log('\nDone! Refresh your dashboard.');
}

seed();
