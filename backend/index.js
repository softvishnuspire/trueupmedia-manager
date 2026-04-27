const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

app.use(compression());

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL ERROR: Missing Supabase Environment Variables!');
    console.error('Please ensure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set.');
    console.error('Current URL:', supabaseUrl ? 'Set' : 'MISSING');
    console.error('Current Key:', supabaseKey ? 'Set' : 'MISSING');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NodeCache = require("node-cache");
const myCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`⚠️  No token provided for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Fast path: Check cache first
    const cachedUser = myCache.get(`auth_${token}`);
    if (cachedUser) {
        req.user = cachedUser;
        return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        console.error('❌ Auth Error:', error?.message || 'User not found');
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Cache the user object for 60 seconds to avoid repeating network calls on subsequent requests
    myCache.set(`auth_${token}`, user, 60);

    console.log(`✅ Auth Success: ${user.email} (${req.method} ${req.url})`);
    req.user = user;
    next();
};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', authenticateUser);

const normalizeRole = (role) => (role || '').toString().trim().toUpperCase().replace(/[_\s]+/g, ' ');

const getRequesterRole = async (user) => {
    const userId = user?.id;
    if (!userId) return null;

    // Fast path: Check cache
    const cachedRole = myCache.get(`role_${userId}`);
    if (cachedRole) return cachedRole;

    let profile = null;
    let profileErr = null;

    const byUserId = await supabase
        .from('users')
        .select('role')
        .eq('user_id', userId)
        .single();
    profile = byUserId.data;
    profileErr = byUserId.error;

    if ((!profile || profileErr) && user?.email) {
        const byEmail = await supabase
            .from('users')
            .select('role')
            .eq('email', user.email)
            .single();
        profile = byEmail.data;
        profileErr = byEmail.error;
    }

    const metadataRole = user?.user_metadata?.role || user?.app_metadata?.role;
    const resolvedRole = normalizeRole(profile?.role || metadataRole);
    
    // Cache the resolved role for 60 seconds
    if (resolvedRole) {
        myCache.set(`role_${userId}`, resolvedRole, 60);
    }
    
    return resolvedRole;
};

const requireRoles = (allowedRoles) => {
    const normalizedAllowed = allowedRoles.map((role) => normalizeRole(role));

    return async (req, res, next) => {
        try {
            const resolvedRole = await getRequesterRole(req.user);
            if (!resolvedRole) {
                return res.status(403).json({ error: 'User profile not found' });
            }
            if (!normalizedAllowed.includes(resolvedRole)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            req.resolvedRole = resolvedRole;
            next();
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    };
};

const STATUS_FLOWS = {
    'Reel': [
        'CONTENT READY',
        'SHOOT DONE',
        'EDITING IN PROGRESS',
        'EDITED',
        'WAITING FOR APPROVAL',
        'APPROVED',
        'WAITING FOR POSTING',
        'POSTED'
    ],
    'Post': [
        'CONTENT APPROVED',
        'DESIGNING IN PROGRESS',
        'DESIGNING COMPLETED',
        'WAITING FOR APPROVAL',
        'APPROVED',
        'WAITING FOR POSTING',
        'POSTED'
    ]
};

// ─── GM: Clients ───
app.get('/api/gm/clients', async (req, res) => {
    const cached = myCache.get("gm_clients");
    if (cached) return res.json(cached);

    const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('is_active', true)
        .eq('is_deleted', false);

    if (error) return res.status(500).json({ error: error.message });
    myCache.set("gm_clients", data);
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
    const { title, description, scheduled_datetime, is_rescheduled } = req.body;
    const { data, error } = await supabase
        .from('content_items')
        .update({ title, description, scheduled_datetime, is_rescheduled })
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
    try {
        const [itemRes, logsRes] = await Promise.all([
            supabase.from('content_items').select(`*, clients (company_name)`).eq('id', id).single(),
            supabase.from('status_logs').select(`*, users:changed_by (name, role_identifier)`).eq('item_id', id).order('changed_at', { ascending: false })
        ]);

        if (itemRes.error) return res.status(500).json({ error: itemRes.error.message });
        res.json({ item: itemRes.data, history: logsRes.data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/gm/content/:id/status', async (req, res) => {
    const { id } = req.params;
    const { new_status, note, changed_by } = req.body;

    console.log(`[StatusUpdate] ID: ${id}, New: ${new_status}, Note: ${note}, User: ${changed_by}`);

    const { data: item, error: fetchError } = await supabase
        .from('content_items')
        .select('status, content_type')
        .eq('id', id)
        .single();

    if (fetchError || !item) {
        console.error('[StatusUpdate] Fetch error:', fetchError);
        return res.status(404).json({ error: 'Item not found' });
    }

    const flow = STATUS_FLOWS[item.content_type];
    const currentIndex = flow.indexOf(item.status);
    const newIndex = flow.indexOf(new_status);

    if (newIndex !== currentIndex + 1) {
        return res.status(400).json({
            error: `Invalid status transition. Next status should be: ${flow[currentIndex + 1] || 'None'}`
        });
    }

    // Update status
    const { error: updateError } = await supabase
        .from('content_items')
        .update({ status: new_status, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (updateError) {
        console.error('[StatusUpdate] Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update status' });
    }

    // Log the change
    const logData = {
        item_id: id,
        old_status: item.status,
        new_status: new_status,
        note: note || null,
        changed_by: changed_by || null
    };

    const { error: logError } = await supabase.from('status_logs').insert([logData]);

    if (logError) {
        console.error('[StatusUpdate] Log error:', logError);
    } else {
        console.log('[StatusUpdate] Success logging change');
    }

    res.json({ message: 'Status updated successfully' });
});

app.post('/api/gm/content/:id/undo-status', async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch the latest log
        const { data: latestLog, error: logFetchError } = await supabase
            .from('status_logs')
            .select('*')
            .eq('item_id', id)
            .order('changed_at', { ascending: false })
            .limit(1)
            .single();

        if (logFetchError || !latestLog) {
            return res.status(404).json({ error: 'No status history found to undo' });
        }

        // Revert status in content_items
        const { error: revertError } = await supabase
            .from('content_items')
            .update({ status: latestLog.old_status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (revertError) {
            return res.status(500).json({ error: 'Failed to revert status' });
        }

        // Delete the log entry
        await supabase.from('status_logs').delete().eq('id', latestLog.id);

        res.json({ message: 'Status reverted successfully', previous_status: latestLog.old_status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Admin: Client Management ───
app.get('/api/admin/clients', async (req, res) => {
    const cached = myCache.get("admin_clients");
    if (cached) return res.json(cached);

    const { data, error } = await supabase.from('clients').select('*').eq('is_deleted', false).order('company_name');
    if (error) return res.status(500).json({ error: error.message });
    myCache.set("admin_clients", data);
    res.json(data);
});

app.post('/api/admin/clients', requireRoles(['ADMIN']), async (req, res) => {
    const { company_name, phone, email, address, posts_per_month, reels_per_month } = req.body;
    if (!company_name) return res.status(400).json({ error: 'Company Name is mandatory' });
    const { data, error } = await supabase.from('clients').insert([{
        company_name,
        phone,
        email,
        address,
        posts_per_month: parseInt(posts_per_month) || 0,
        reels_per_month: parseInt(reels_per_month) || 0,
        is_active: true,
        is_deleted: false
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    myCache.del(["gm_clients", "admin_clients"]);
    res.json(data[0]);
});

app.put('/api/admin/clients/:id', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { company_name, phone, email, address, is_active, posts_per_month, reels_per_month } = req.body;
    const { data, error } = await supabase.from('clients').update({
        company_name,
        phone,
        email,
        address,
        is_active,
        posts_per_month: parseInt(posts_per_month) || 0,
        reels_per_month: parseInt(reels_per_month) || 0
    }).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    myCache.del(["gm_clients", "admin_clients"]);
    res.json(data[0]);
});

app.delete('/api/admin/clients/:id', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    myCache.del(["gm_clients", "admin_clients"]);
    res.json({ message: 'Client removed successfully' });
});

// ─── Admin: Team Management ───
app.get('/api/admin/team', async (req, res) => {
    const cached = myCache.get("admin_team");
    if (cached) return res.json(cached);

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Filter in JS to avoid enum-space matching issues in some environments
    const teamLeads = (data || []).filter(u => ['TL1', 'TL2', 'TEAM LEAD'].includes(u.role));
    myCache.set("admin_team", teamLeads);
    res.json(teamLeads);
});

app.post('/api/admin/team', requireRoles(['ADMIN']), async (req, res) => {
    const { name, email, password, role, role_identifier } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });

    console.log(`[Admin] Creating new user: ${email} (${role})`);

    try {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { role, name, role_identifier }
        });
        if (authError) {
            console.error(`[Admin] Auth creation error for ${email}:`, authError.message);
            return res.status(500).json({ error: authError.message });
        }

        const { data, error } = await supabase.from('users').insert([{
            user_id: authUser.user.id,
            name,
            email,
            password_hash: password,
            role,
            role_identifier: role_identifier || role
        }]).select();

        if (error) {
            console.error(`[Admin] DB insertion error for ${email}:`, error.message);
            await supabase.auth.admin.deleteUser(authUser.user.id);
            return res.status(500).json({ error: error.message });
        }

        myCache.del("admin_team");
        res.json(data[0]);
    } catch (error) {
        console.error(`[Admin] Crash during creation of ${email}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/team/:id', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role_identifier } = req.body;

    console.log(`[Admin] Update request for ID: ${id}, Email: ${email}`);

    try {
        const updateData = {
            email,
            user_metadata: { name, role_identifier }
        };
        if (password) updateData.password = password;

        const { error: authError } = await supabase.auth.admin.updateUserById(id, updateData);

        if (authError) {
            console.warn(`[Admin] Auth update warning for ${id}:`, authError.message);
            // If user doesn't exist in Auth, create them!
            if (authError.message.includes('not found')) {
                console.log(`[Admin] Creating missing auth user for ${email}`);
                const { error: createError } = await supabase.auth.admin.createUser({
                    email,
                    password: password || 'Trueup@123',
                    email_confirm: true,
                    user_metadata: { name, role_identifier }
                });
                if (createError) return res.status(500).json({ error: createError.message });
            } else {
                return res.status(500).json({ error: authError.message });
            }
        }

        const updatePayload = { name, email, role_identifier };
        if (password) updatePayload.password_hash = password;

        const { data, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('user_id', id)
            .select();

        if (error) {
            console.error(`[Admin] DB update error for ${id}:`, error.message);
            return res.status(500).json({ error: error.message });
        }

        myCache.del("admin_team");
        res.json(data[0]);
    } catch (error) {
        console.error(`[Admin] Crash during update for ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/team/:id', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    console.log(`[Admin] Delete request for user: ${id}`);

    try {
        // 1. Unassign this team lead from any clients they manage
        const { error: unassignError } = await supabase
            .from('clients')
            .update({ team_lead_id: null })
            .eq('team_lead_id', id);

        if (unassignError) {
            console.error(`[Admin] Unassignment error for ${id}:`, unassignError.message);
        }

        // 2. Delete from Auth (prevents future logins)
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError && authError.message !== 'User not found') {
            console.error(`[Admin] Auth deletion error for ${id}:`, authError.message);
        }

        // 3. Delete from users table
        const { error: dbError } = await supabase.from('users').delete().eq('user_id', id);
        if (dbError) {
            console.error(`[Admin] DB deletion error for ${id}:`, dbError.message);
            return res.status(500).json({ error: dbError.message });
        }

        myCache.del("admin_team");
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(`[Admin] Crash during deletion of ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Admin: Dashboard Stats ───
app.get('/api/admin/stats', async (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const mon = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    try {
        const [clientRes, itemRes, statusRes] = await Promise.all([
            supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_deleted', false),
            supabase.from('content_items').select('*', { count: 'exact', head: true }).gte('scheduled_datetime', startDate).lte('scheduled_datetime', endDate),
            supabase.from('content_items').select('status')
        ]);

        const statusSummary = {};
        if (statusRes.data) {
            statusRes.data.forEach(item => { statusSummary[item.status] = (statusSummary[item.status] || 0) + 1; });
        }

        res.json({
            totalClients: clientRes.count,
            totalItemsThisMonth: itemRes.count,
            statusSummary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Admin: Master Calendar ───
app.get('/api/admin/master-calendar', async (req, res) => {
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

app.get('/api/admin/content/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [itemRes, logsRes] = await Promise.all([
            supabase.from('content_items').select(`*, clients (company_name)`).eq('id', id).single(),
            supabase.from('status_logs').select(`*, users:changed_by (name, role_identifier)`).eq('item_id', id).order('changed_at', { ascending: false })
        ]);

        if (itemRes.error) return res.status(500).json({ error: itemRes.error.message });
        res.json({ item: itemRes.data, history: logsRes.data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── COO: Read-only Monitoring ───
app.get('/api/coo/clients', requireRoles(['COO', 'ADMIN']), async (req, res) => {
    const { data, error } = await supabase.from('clients').select('*').eq('is_deleted', false).order('company_name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/coo/team', requireRoles(['COO', 'ADMIN']), async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    const teamLeads = (data || []).filter(u => ['TL1', 'TL2', 'TEAM LEAD'].includes(u.role));
    res.json(teamLeads);
});

app.get('/api/coo/stats', requireRoles(['COO', 'ADMIN']), async (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const mon = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    try {
        const [clientRes, itemRes, statusRes] = await Promise.all([
            supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_deleted', false),
            supabase.from('content_items').select('*', { count: 'exact', head: true }).gte('scheduled_datetime', startDate).lte('scheduled_datetime', endDate),
            supabase.from('content_items').select('status')
        ]);

        const statusSummary = {};
        if (statusRes.data) {
            statusRes.data.forEach(item => { statusSummary[item.status] = (statusSummary[item.status] || 0) + 1; });
        }

        res.json({
            totalClients: clientRes.count,
            totalItemsThisMonth: itemRes.count,
            statusSummary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/coo/master-calendar', requireRoles(['COO', 'ADMIN']), async (req, res) => {
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

app.get('/api/coo/content/:id', requireRoles(['COO', 'ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
        const [itemRes, logsRes] = await Promise.all([
            supabase.from('content_items').select(`*, clients (company_name)`).eq('id', id).single(),
            supabase.from('status_logs').select(`*, users:changed_by (name, role_identifier)`).eq('item_id', id).order('changed_at', { ascending: false })
        ]);

        if (itemRes.error) return res.status(500).json({ error: itemRes.error.message });
        res.json({ item: itemRes.data, history: logsRes.data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/content/:id/undo-status', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
        const { data: latestLog, error: logFetchError } = await supabase
            .from('status_logs')
            .select('*')
            .eq('item_id', id)
            .order('changed_at', { ascending: false })
            .limit(1)
            .single();

        if (logFetchError || !latestLog) return res.status(404).json({ error: 'No status history found' });

        const { error: revertError } = await supabase
            .from('content_items')
            .update({ status: latestLog.old_status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (revertError) return res.status(500).json({ error: 'Failed to revert' });
        await supabase.from('status_logs').delete().eq('id', latestLog.id);
        res.json({ message: 'Success', previous_status: latestLog.old_status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/content', requireRoles(['ADMIN']), async (req, res) => {
    const { client_id, title, description, content_type, scheduled_datetime } = req.body;
    const initial_status = content_type === 'Post' ? 'CONTENT APPROVED' : 'CONTENT READY';

    const { data, error } = await supabase
        .from('content_items')
        .insert([{ client_id, title, description, content_type, scheduled_datetime, status: initial_status }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/admin/content/:id', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { title, description, scheduled_datetime, is_rescheduled, content_type } = req.body;
    const { data, error } = await supabase
        .from('content_items')
        .update({ title, description, scheduled_datetime, is_rescheduled, content_type })
        .eq('id', id)
        .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.delete('/api/admin/content/:id', requireRoles(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Deleted successfully' });
});


// ─── Team Leads ───
app.get('/api/gm/team-leads', async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('user_id, name, email, role, role_identifier');

    if (error) return res.status(500).json({ error: error.message });

    // Filter in JS to avoid enum-space matching issues
    const teamLeads = (data || []).filter(u => ['TL1', 'TL2', 'TEAM LEAD'].includes(u.role));
    res.json(teamLeads);
});

// ─── Assign Client to Team Lead ───
app.patch('/api/gm/clients/:id/assign', async (req, res) => {
    const { id } = req.params;
    let { team_lead_id } = req.body;

    // Convert empty string to null for unassignment
    if (team_lead_id === '') team_lead_id = null;

    try {
        // Fetch current assignment to clear old lead's cache
        const { data: currentClient } = await supabase
            .from('clients')
            .select('team_lead_id')
            .eq('id', id)
            .single();

        const { data, error } = await supabase
            .from('clients')
            .update({ team_lead_id })
            .eq('id', id)
            .select();

        if (error) return res.status(500).json({ error: error.message });

        // Clear caches
        if (currentClient?.team_lead_id) {
            myCache.del(`tl_clients_${currentClient.team_lead_id}`);
        }
        if (team_lead_id) {
            myCache.del(`tl_clients_${team_lead_id}`);
        }
        myCache.del(["gm_clients", "admin_clients"]);

        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get Clients for a Team Lead ───
app.get('/api/gm/team-leads/:id/clients', async (req, res) => {
    const { id } = req.params;
    const cacheKey = `tl_clients_${id}`;
    const cached = myCache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('team_lead_id', id)
        .eq('is_active', true)
        .eq('is_deleted', false);

    if (error) return res.status(500).json({ error: error.message });
    myCache.set(cacheKey, data);
    res.json(data);
});

// ─── Team Lead Endpoints ───
app.get('/api/tl/clients', async (req, res) => {
    const { tlId } = req.query;
    console.log('Fetching TL clients for ID:', tlId);

    if (!tlId) return res.status(400).json({ error: 'Missing tlId' });

    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('team_lead_id', tlId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('company_name');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/tl/calendar', async (req, res) => {
    const { client_id, month, tlId } = req.query;
    console.log(`Fetching calendar for client ${client_id}, month ${month}, TL ${tlId}`);

    if (!client_id || !month || !tlId) return res.status(400).json({ error: 'Missing client_id, month, or tlId' });

    // Verify TL manages this client
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('team_lead_id', tlId)
        .single();

    if (clientError || !client) return res.status(403).json({ error: 'Access denied' });

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

// ─── Team Lead: Content Management ───
app.get('/api/tl/clients', async (req, res) => {
    const { tlId } = req.query;
    if (!tlId) return res.status(400).json({ error: 'tlId is required' });

    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('team_lead_id', tlId)
        .eq('is_deleted', false);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/tl/calendar', async (req, res) => {
    const { client_id, month, tlId } = req.query;
    if (!client_id || !month || !tlId) return res.status(400).json({ error: 'Missing parameters' });

    // Verify client belongs to this TL
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('team_lead_id', tlId)
        .single();

    if (clientError || !client) return res.status(403).json({ error: 'Unauthorized or client not found' });

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

app.get('/api/tl/master-calendar', async (req, res) => {
    const { month, tlId, content_type } = req.query;
    console.log(`Fetching master calendar for month ${month}, TL ${tlId}`);

    if (!month || !tlId) return res.status(400).json({ error: 'Missing month or tlId' });

    // Get all clients for this TL
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .eq('team_lead_id', tlId);

    if (clientsError) return res.status(500).json({ error: clientsError.message });
    if (!clients || clients.length === 0) return res.json([]);

    const clientIds = clients.map(c => c.id);

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    let query = supabase
        .from('content_items')
        .select(`*, clients (company_name)`)
        .in('client_id', clientIds)
        .gte('scheduled_datetime', startDate)
        .lte('scheduled_datetime', endDate);

    if (content_type) query = query.eq('content_type', content_type);

    const { data, error } = await query.order('scheduled_datetime');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ─── POC Communication (Team Lead + GM) ───
app.get('/api/tl/poc-notes', async (req, res) => {
    const { month, tlId } = req.query;
    if (!month || !tlId) return res.status(400).json({ error: 'Missing month or tlId' });

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
        .from('poc_communications')
        .select(`id, team_lead_id, note_date, note_text, created_at, users:team_lead_id (name, role_identifier)`)
        .eq('team_lead_id', tlId)
        .gte('note_date', startDate)
        .lte('note_date', endDate)
        .order('note_date', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.post('/api/tl/poc-notes', async (req, res) => {
    const { tlId, note_date, note_text } = req.body;
    if (!tlId || !note_date || !note_text?.trim()) {
        return res.status(400).json({ error: 'tlId, note_date and note_text are required' });
    }

    const { data, error } = await supabase
        .from('poc_communications')
        .insert([{
            team_lead_id: tlId,
            note_date,
            note_text: note_text.trim()
        }])
        .select(`id, team_lead_id, note_date, note_text, created_at, users:team_lead_id (name, role_identifier)`)
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/gm/poc-notes', async (req, res) => {
    const { month, team_lead_id } = req.query;
    if (!month) return res.status(400).json({ error: 'Missing month' });

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;

    let query = supabase
        .from('poc_communications')
        .select(`id, team_lead_id, note_date, note_text, created_at, users:team_lead_id (name, role_identifier)`)
        .gte('note_date', startDate)
        .lte('note_date', endDate)
        .order('note_date', { ascending: true })
        .order('created_at', { ascending: false });

    if (team_lead_id) {
        query = query.eq('team_lead_id', team_lead_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ─── Posting Team Endpoints ───

// Today's Posting Queue
app.get('/api/posting/today', async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const mon = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const startDate = `${year}-${mon}-${day}T00:00:00`;
        const endDate = `${year}-${mon}-${day}T23:59:59`;

        const { data, error } = await supabase
            .from('content_items')
            .select(`*, clients (company_name)`)
            .in('status', ['WAITING FOR POSTING', 'POSTED'])
            .gte('scheduled_datetime', startDate)
            .lte('scheduled_datetime', endDate)
            .order('scheduled_datetime');

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Posting Team: Client Calendar (filtered to WAITING FOR POSTING only)
app.get('/api/posting/calendar', async (req, res) => {
    const { client_id, month, status, all } = req.query;
    if (!client_id || !month) return res.status(400).json({ error: 'Missing client_id or month' });

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01T00:00:00`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    let query = supabase
        .from('content_items')
        .select(`*, clients (company_name)`)
        .eq('client_id', client_id)
        .gte('scheduled_datetime', startDate)
        .lte('scheduled_datetime', endDate);

    // Strictly filter by status unless 'all' is explicitly requested
    if (all === 'true') {
        // No status filter
    } else if (status) {
        query = query.eq('status', status);
    } else {
        query = query.eq('status', 'WAITING FOR POSTING');
    }

    const { data, error } = await query.order('scheduled_datetime');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Posting Team: Master Calendar (filtered to WAITING FOR POSTING only)
app.get('/api/posting/master-calendar', async (req, res) => {
    const { month, client_id, status, all } = req.query;
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
    
    // Strictly filter by status unless 'all' is explicitly requested (for stats)
    if (all === 'true') {
        // No status filter
    } else if (status) {
        query = query.eq('status', status);
    } else {
        query = query.eq('status', 'WAITING FOR POSTING');
    }

    const { data, error } = await query.order('scheduled_datetime');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Posting Team: Clients list (for calendar dropdown)
app.get('/api/posting/clients', async (req, res) => {
    const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('company_name');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Posting Team: Content Details (for status history)
app.get('/api/posting/content/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [itemRes, logsRes] = await Promise.all([
            supabase.from('content_items').select(`*, clients (company_name)`).eq('id', id).single(),
            supabase.from('status_logs').select(`*, users:changed_by (name, role_identifier)`).eq('item_id', id).order('changed_at', { ascending: false })
        ]);

        if (itemRes.error) return res.status(500).json({ error: itemRes.error.message });
        res.json({ item: itemRes.data, history: logsRes.data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Posting Team: Mark as Posted (ONLY allowed transition)
app.patch('/api/posting/content/:id/post', async (req, res) => {
    const { id } = req.params;
    const { changed_by } = req.body;

    try {
        // Fetch current item
        const { data: item, error: fetchError } = await supabase
            .from('content_items')
            .select('status, content_type')
            .eq('id', id)
            .single();

        if (fetchError || !item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // CRITICAL: Only allow WAITING FOR POSTING → POSTED
        if (item.status !== 'WAITING FOR POSTING') {
            return res.status(400).json({
                error: `Invalid transition. Current status is "${item.status}". Only items with "WAITING FOR POSTING" can be marked as posted.`
            });
        }

        // Update status to POSTED with timestamp
        const { error: updateError } = await supabase
            .from('content_items')
            .update({
                status: 'POSTED',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update status' });
        }

        // Log the status change
        const { error: logError } = await supabase.from('status_logs').insert([{
            item_id: id,
            old_status: 'WAITING FOR POSTING',
            new_status: 'POSTED',
            changed_by: changed_by || null,
            note: 'Marked as posted by Posting Team'
        }]);

        if (logError) {
            console.error('[PostingTeam] Log error:', logError);
        }

        res.json({ message: 'Content marked as POSTED successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Posting Team: Undo Posted (Rollback)
app.post('/api/posting/content/:id/undo', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: latestLog, error: logFetchError } = await supabase
            .from('status_logs')
            .select('*')
            .eq('item_id', id)
            .eq('new_status', 'POSTED')
            .order('changed_at', { ascending: false })
            .limit(1)
            .single();

        if (logFetchError || !latestLog) return res.status(404).json({ error: 'No recent posting history found' });

        const { error: revertError } = await supabase
            .from('content_items')
            .update({ status: 'WAITING FOR POSTING', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (revertError) return res.status(500).json({ error: 'Failed to revert status' });

        await supabase.from('status_logs').delete().eq('id', latestLog.id);
        res.json({ message: 'Success', status: 'WAITING FOR POSTING' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Notifications ───

// Send Notification (Admin or GM only)
app.post('/api/notifications/send', async (req, res) => {
    try {
        const { title, message, type, target } = req.body;
        const sender = req.user; // from authenticateUser
        const normalizedType = (type || 'INFO').toString().toUpperCase();

        if (!title || !message || !target?.type) {
            return res.status(400).json({ error: 'title, message and target are required' });
        }
        if (!['INFO', 'WARNING', 'URGENT'].includes(normalizedType)) {
            return res.status(400).json({ error: 'Invalid notification type' });
        }

        // Check sender role
        const { data: senderData, error: senderError } = await supabase
            .from('users')
            .select('role, role_identifier')
            .eq('user_id', sender.id)
            .single();

        if (senderError || !senderData) {
            return res.status(401).json({ error: 'Sender role not found' });
        }

        const senderRole = normalizeRole(senderData.role);
        const senderRoleIdentifier = normalizeRole(senderData.role_identifier);
        const isAdmin = senderRole === 'ADMIN';
        const isGM = senderRole === 'GENERAL MANAGER' || senderRole === 'GM' || senderRoleIdentifier === 'GM';

        if (!isAdmin && !isGM) {
            return res.status(403).json({ error: 'Unauthorized to send notifications' });
        }

        const targetType = target.type.toString().toUpperCase();
        const targetValue = target.value;

        if (isGM) {
            if (targetType === 'ALL') {
                return res.status(403).json({ error: 'GM cannot broadcast to all users' });
            }
            if (targetType === 'ROLE') {
                const normalizedTargetRole = normalizeRole(targetValue);
                const allowedRoles = ['TEAM LEAD', 'POSTING TEAM'];
                if (!allowedRoles.includes(normalizedTargetRole)) {
                    return res.status(403).json({ error: 'GM can only notify Team Leads and Posting Team' });
                }
            } else if (targetType === 'ROLE_IDENTIFIER') {
                const normalizedIdentifier = normalizeRole(targetValue);
                if (!['TL1', 'TL2'].includes(normalizedIdentifier)) {
                    return res.status(403).json({ error: 'GM can only target TL1 or TL2 role identifiers' });
                }
            } else if (targetType === 'USER') {
                const { data: receiver } = await supabase
                    .from('users')
                    .select('role, role_identifier')
                    .eq('user_id', targetValue)
                    .single();
                const receiverRole = normalizeRole(receiver?.role);
                const receiverIdentifier = normalizeRole(receiver?.role_identifier);
                const allowedDirectTargets = receiverRole === 'TEAM LEAD'
                    || receiverRole === 'POSTING TEAM'
                    || ['TL1', 'TL2'].includes(receiverIdentifier);

                if (!allowedDirectTargets) {
                    return res.status(403).json({ error: 'GM can only message TL1/TL2/Posting Team users' });
                }
            } else {
                return res.status(400).json({ error: 'Invalid target type' });
            }
        }

        // Insert Notification
        const { data: notification, error: notifError } = await supabase
            .from('notifications')
            .insert([{
                title,
                message,
                type: normalizedType,
                sender_id: sender.id
            }])
            .select()
            .single();

        if (notifError) {
            return res.status(500).json({ error: 'Failed to create notification', details: notifError.message });
        }

        // Determine Recipients
        let recipientQuery = supabase.from('users').select('user_id');
        if (targetType === 'ROLE') {
            const normalizedTargetRole = normalizeRole(targetValue);
            if (normalizedTargetRole === 'POSTING TEAM') {
                recipientQuery = recipientQuery.in('role', ['POSTING TEAM', 'POSTING_TEAM']);
            } else if (normalizedTargetRole === 'GENERAL MANAGER') {
                recipientQuery = recipientQuery.in('role', ['GENERAL MANAGER', 'GM']);
            } else {
                recipientQuery = recipientQuery.eq('role', normalizedTargetRole);
            }
        } else if (targetType === 'ROLE_IDENTIFIER') {
            recipientQuery = recipientQuery.eq('role_identifier', targetValue);
        } else if (targetType === 'USER') {
            recipientQuery = recipientQuery.eq('user_id', targetValue);
        } else if (targetType === 'ALL') {
            // keep default recipientQuery (all users)
        } else {
            return res.status(400).json({ error: 'Invalid target type' });
        }

        const { data: users, error: usersError } = await recipientQuery;
        if (usersError || !users.length) {
            return res.status(400).json({ error: 'No recipients found' });
        }

        // Insert Recipients
        const recipientInserts = users.map(u => ({
            notification_id: notification.notification_id,
            user_id: u.user_id
        }));

        const { error: recipError } = await supabase
            .from('notification_recipients')
            .insert(recipientInserts);

        if (recipError) {
            return res.status(500).json({ error: 'Failed to assign recipients', details: recipError.message });
        }

        res.json({ message: 'Notification sent successfully', notification });
    } catch (err) {
        console.error('Send notification error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get User Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const { data, error } = await supabase
            .from('notification_recipients')
            .select('id, is_read, read_at, notification_id, notifications(title, message, type, created_at, sender_id)')
            .eq('user_id', userId);
        
        if (error) {
            console.error('Failed to fetch notifications:', error);
            return res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
        }
        
        // Sort by notification created_at descending
        const sortedData = [...(data || [])].sort((a, b) => {
            const dateA = a?.notifications?.created_at ? new Date(a.notifications.created_at).getTime() : 0;
            const dateB = b?.notifications?.created_at ? new Date(b.notifications.created_at).getTime() : 0;
            return dateB - dateA;
        });

        res.json(sortedData);
    } catch (err) {
        console.error('Notification fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Mark as Read
app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id; // From URL, user gives the notification_id
        
        const { error } = await supabase
            .from('notification_recipients')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('notification_id', notificationId)
            .eq('user_id', userId);

        if (error) {
            return res.status(500).json({ error: 'Failed to mark as read', details: error.message });
        }
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unread Count
app.get('/api/notifications/unread-count', async (req, res) => {
    try {
        const userId = req.user.id;
        const { count, error } = await supabase
            .from('notification_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Failed to get unread count:', error);
            return res.status(500).json({ error: 'Failed to get unread count', details: error.message });
        }
        res.json({ count });
    } catch (err) {
        console.error('Unread count error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Emergency Tasks ───
app.post('/api/emergency/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const resolvedRole = await getRequesterRole(req.user);

        if (!resolvedRole) {
            return res.status(403).json({ error: 'User profile not found' });
        }

        const allowed = ['ADMIN', 'GENERAL MANAGER', 'GM', 'COO'].includes(resolvedRole);
        if (!allowed) {
            return res.status(403).json({ error: 'Only Admin, GM, and COO can toggle emergency status' });
        }

        // Get current state
        const { data: item, error: fetchErr } = await supabase
            .from('content_items')
            .select('is_emergency')
            .eq('id', id)
            .single();

        if (fetchErr) return res.status(500).json({ error: fetchErr.message });

        const newState = !item.is_emergency;
        const updateData = {
            is_emergency: newState,
            emergency_marked_by: newState ? userId : null,
            emergency_marked_at: newState ? new Date().toISOString() : null
        };

        const { error } = await supabase
            .from('content_items')
            .update(updateData)
            .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, is_emergency: newState });
    } catch (err) {
        console.error('Emergency toggle error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/emergency/all', async (req, res) => {
    try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dayStart = `${yyyy}-${mm}-${dd}T00:00:00`;
        const dayEnd = `${yyyy}-${mm}-${dd}T23:59:59`;

        const { data, error } = await supabase
            .from('content_items')
            .select(`*, clients (company_name)`)
            .or(`is_emergency.eq.true,and(scheduled_datetime.gte.${dayStart},scheduled_datetime.lte.${dayEnd})`)
            .order('scheduled_datetime');

        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (err) {
        console.error('Emergency all error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/emergency/today', async (req, res) => {
    try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dayStart = `${yyyy}-${mm}-${dd}T00:00:00`;
        const dayEnd = `${yyyy}-${mm}-${dd}T23:59:59`;

        const { data, error } = await supabase
            .from('content_items')
            .select(`*, clients (company_name)`)
            .or(`is_emergency.eq.true,and(scheduled_datetime.gte.${dayStart},scheduled_datetime.lte.${dayEnd})`)
            .order('scheduled_datetime');

        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (err) {
        console.error('Emergency today error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/emergency/month', async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) return res.status(400).json({ error: 'Missing month parameter (YYYY-MM)' });

        const [year, mon] = month.split('-');
        const startDate = `${year}-${mon}-01T00:00:00`;
        const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
        const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}T23:59:59`;

        const { data, error } = await supabase
            .from('content_items')
            .select(`*, clients (company_name)`)
            .eq('is_emergency', true)
            .gte('scheduled_datetime', startDate)
            .lte('scheduled_datetime', endDate)
            .order('scheduled_datetime');

        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (err) {
        console.error('Emergency month error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
