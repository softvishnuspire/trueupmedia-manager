const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STATUS_FLOWS = {
    'Reel': [
        'CONTENT READY',
        'SHOOT DONE',
        'EDITING IN PROGRESS',
        'EDITED',
        'WAITING FOR APPROVAL',
        'APPROVED',
        'POSTED'
    ],
    'Post': [
        'CONTENT APPROVED',
        'DESIGNING IN PROGRESS',
        'DESIGNING COMPLETED',
        'WAITING FOR APPROVAL',
        'APPROVED'
    ]
};

// ─── GM: Clients ───
app.get('/api/gm/clients', async (req, res) => {
    const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('is_active', true)
        .eq('is_deleted', false);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ─── GM: Calendar ───
app.get('/api/gm/calendar', async (req, res) => {
    const { client_id, month } = req.query;
    if (!client_id || !month) return res.status(400).json({ error: 'Missing client_id or month' });

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const { data, error } = await supabase
        .from('content_items')
        .select('*')
        .eq('client_id', client_id)
        .gte('scheduled_datetime', startDate)
        .lte('scheduled_datetime', endDate)
        .order('scheduled_datetime');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ─── GM: Master Calendar ───
app.get('/api/gm/master-calendar', async (req, res) => {
    const { month, client_id, content_type } = req.query;
    if (!month) return res.status(400).json({ error: 'Missing month' });

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    let query = supabase
        .from('content_items')
        .select(`*, clients (company_name)`)
        .gte('scheduled_datetime', startDate)
        .lte('scheduled_datetime', endDate);

    if (client_id) query = query.eq('client_id', client_id);
    if (content_type) query = query.eq('content_type', content_type);

    const { data, error } = await query.order('scheduled_datetime');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ─── GM: Content CRUD ───
app.post('/api/gm/content', async (req, res) => {
    const { client_id, title, description, content_type, scheduled_datetime } = req.body;
    const initial_status = content_type === 'Post' ? 'CONTENT APPROVED' : 'CONTENT READY';

    const { data, error } = await supabase
        .from('content_items')
        .insert([{ client_id, title, description, content_type, scheduled_datetime, status: initial_status }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/gm/content/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, scheduled_datetime } = req.body;
    const { data, error } = await supabase
        .from('content_items')
        .update({ title, description, scheduled_datetime })
        .eq('id', id)
        .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/gm/content/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Deleted successfully' });
});

app.get('/api/gm/content/:id', async (req, res) => {
    const { id } = req.params;
    const { data: item, error: itemError } = await supabase
        .from('content_items')
        .select(`*, clients (company_name)`)
        .eq('id', id)
        .single();

    if (itemError) return res.status(500).json({ error: itemError.message });

    const { data: logs } = await supabase
        .from('status_logs')
        .select('*')
        .eq('item_id', id)
        .order('changed_at', { ascending: false });

    res.json({ item, history: logs || [] });
});

app.patch('/api/gm/content/:id/status', async (req, res) => {
    const { id } = req.params;
    const { new_status } = req.body;

    const { data: item, error: fetchError } = await supabase
        .from('content_items')
        .select('status, content_type')
        .eq('id', id)
        .single();

    if (fetchError || !item) return res.status(404).json({ error: 'Item not found' });

    const flow = STATUS_FLOWS[item.content_type];
    const currentIndex = flow.indexOf(item.status);
    const newIndex = flow.indexOf(new_status);

    if (newIndex !== currentIndex + 1) {
        return res.status(400).json({ 
            error: `Invalid status transition. Next status should be: ${flow[currentIndex + 1] || 'None'}` 
        });
    }

    const { error: updateError } = await supabase
        .from('content_items')
        .update({ status: new_status })
        .eq('id', id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    await supabase.from('status_logs').insert([{ item_id: id, old_status: item.status, new_status: new_status }]);
    res.json({ message: 'Status updated successfully', new_status });
});

// ─── Admin: Client Management ───
app.get('/api/admin/clients', async (req, res) => {
    const { data, error } = await supabase.from('clients').select('*').eq('is_deleted', false).order('company_name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/admin/clients', async (req, res) => {
    const { company_name, phone, email, address } = req.body;
    if (!company_name) return res.status(400).json({ error: 'Company Name is mandatory' });
    const { data, error } = await supabase.from('clients').insert([{ company_name, phone, email, address, is_active: true, is_deleted: false }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/admin/clients/:id', async (req, res) => {
    const { id } = req.params;
    const { company_name, phone, email, address, is_active } = req.body;
    const { data, error } = await supabase.from('clients').update({ company_name, phone, email, address, is_active }).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/admin/clients/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Client removed successfully' });
});

// ─── Admin: Team Management ───
app.get('/api/admin/team', async (req, res) => {
    const { data, error } = await supabase.from('users').select('*').in('role', ['TL1', 'TL2']).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/admin/team', async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { role, name }
    });
    if (authError) return res.status(500).json({ error: authError.message });

    const { data, error } = await supabase.from('users').insert([{ user_id: authUser.user.id, name, email, password_hash: 'managed_by_auth', role }]).select();
    if (error) {
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
});

app.delete('/api/admin/team/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.auth.admin.deleteUser(id);
    const { error } = await supabase.from('users').delete().eq('user_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Team member removed' });
});

// ─── Admin: Dashboard Stats ───
app.get('/api/admin/stats', async (req, res) => {
    const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_deleted', false);
    
    const now = new Date();
    const year = now.getFullYear();
    const mon = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const { count: itemCount } = await supabase.from('content_items').select('*', { count: 'exact', head: true }).gte('scheduled_datetime', startDate).lte('scheduled_datetime', endDate);

    const { data: statusData } = await supabase.from('content_items').select('status');
    const statusSummary = {};
    if (statusData) {
        statusData.forEach(item => { statusSummary[item.status] = (statusSummary[item.status] || 0) + 1; });
    }

    res.json({ totalClients: clientCount, totalItemsThisMonth: itemCount, statusSummary });
});

// ─── Team Leads ───
app.get('/api/gm/team-leads', async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('user_id, name, email, role')
        .in('role', ['TL1', 'TL2']);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ─── Assign Client to Team Lead ───
app.patch('/api/gm/clients/:id/assign', async (req, res) => {
    const { id } = req.params;
    const { team_lead_id } = req.body;

    const { data, error } = await supabase
        .from('clients')
        .update({ team_lead_id })
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// ─── Get Clients for a Team Lead ───
app.get('/api/gm/team-leads/:id/clients', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('team_lead_id', id)
        .eq('is_active', true)
        .eq('is_deleted', false);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
