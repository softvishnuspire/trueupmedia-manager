require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncUsers() {
    console.log('Fetching users from Auth...');
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Error fetching auth users:', authError);
        return;
    }

    console.log(`Found ${authUsers.length} auth users.`);

    for (const authUser of authUsers) {
        const email = authUser.email;
        const authId = authUser.id;

        console.log(`Checking user: ${email} (Auth ID: ${authId})`);

        // Find user in public.users by email
        const { data: publicUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (fetchError) {
            console.error(`Error fetching public user ${email}:`, fetchError);
            continue;
        }

        if (publicUser) {
            if (publicUser.user_id !== authId) {
                console.log(`Mismatch found for ${email}! Syncing via insert-update-delete...`);
                
                const oldId = publicUser.user_id;

                // Rename old user's email to avoid unique constraint
                const tempEmail = `old_${Date.now()}_${email}`;
                await supabase.from('users').update({ email: tempEmail }).eq('user_id', oldId);

                // 1. Insert user with new ID (copying existing data)
                const { error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        ...publicUser,
                        user_id: authId,
                        email: email, // Use original email
                        password_hash: publicUser.password_hash || 'synced'
                    }]);

                if (insertError) {
                    console.error(`Failed to insert user with new ID for ${email}:`, insertError);
                    // Rollback email rename
                    await supabase.from('users').update({ email: email }).eq('user_id', oldId);
                    continue;
                }

                // 2. Update all references
                console.log(`Updating references from ${oldId} to ${authId}...`);
                await supabase.from('status_logs').update({ changed_by: authId }).eq('changed_by', oldId);
                await supabase.from('clients').update({ team_lead_id: authId }).eq('team_lead_id', oldId);
                await supabase.from('clients').update({ created_by: authId }).eq('created_by', oldId);
                await supabase.from('content_items').update({ created_by: authId }).eq('created_by', oldId);

                // 3. Delete old user
                const { error: deleteError } = await supabase
                    .from('users')
                    .delete()
                    .eq('user_id', oldId);

                if (deleteError) {
                    console.error(`Failed to delete old user for ${email}:`, deleteError);
                } else {
                    console.log(`Successfully synced ${email}.`);
                }
            } else {
                console.log(`${email} is already in sync.`);
            }
        } else {
            console.log(`User ${email} not found in public.users. Creating...`);
            
            // Map metadata role to DB enum
            let dbRole = 'TEAM LEAD';
            const metaRole = (authUser.user_metadata.role || '').toUpperCase();
            if (metaRole.includes('ADMIN')) dbRole = 'ADMIN';
            else if (metaRole.includes('GM') || metaRole.includes('GENERAL')) dbRole = 'GENERAL MANAGER';
            else if (metaRole.includes('COO')) dbRole = 'COO';

            const { error: insertError } = await supabase
                .from('users')
                .insert([{
                    user_id: authId,
                    email: email,
                    name: authUser.user_metadata.name || email.split('@')[0],
                    role: dbRole,
                    role_identifier: authUser.user_metadata.role_identifier || (dbRole === 'TEAM LEAD' ? 'TL' : dbRole),
                    password_hash: 'synced_from_auth'
                }]);
            
            if (insertError) {
                console.error(`Failed to insert user ${email}:`, insertError);
            } else {
                console.log(`Created user ${email} in public.users.`);
            }
        }
    }
}

syncUsers();
