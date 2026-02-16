
import { createClient } from '@supabase/supabase-js';

const DEST_URL = process.env.VITE_SUPABASE_URL || 'https://hrrwmuticuoqercfwzrb.supabase.co';
const DEST_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

const supabase = createClient(DEST_URL, DEST_ANON_KEY);

// List of tables that might have user_id
const USER_TABLES = [
    'orders', 'transactions', 'audit_logs', 'inventory_movements', 
    'purchase_orders', 'shipment_audit_logs', 'shipment_orders', 
    'stock_opname_sessions', 'stock_opname_approvals'
];

async function fixUser(email, password) {
    console.log(`\nProcessing ${email}...`);

    // 1. Get current public.users entry (Old ID)
    const { data: existingUsers, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

    if (fetchError) {
        console.error(`Error fetching user: ${fetchError.message}`);
        return;
    }

    let oldId = null;
    let oldUser = null;
    if (existingUsers && existingUsers.length > 0) {
        oldUser = existingUsers[0];
        oldId = oldUser.id;
        console.log(`Found existing public user. Old ID: ${oldId}`);
    } else {
        console.log('User not found in public.users. Will create new.');
    }

    // 2. Sign Up (Create Auth User -> New ID)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: oldUser?.name || email.split('@')[0],
                role: 'superadmin'
            }
        }
    });

    if (authError) {
        // If user already registered, maybe we just need to get their ID?
        // But we can't get ID from signUp error usually.
        // We'll assume if they exist in Auth, we can try to SignIn to get ID?
        if (authError.message.includes('User already registered')) {
             console.log('User already in Auth. Attempting login to get ID...');
             const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                 email, password
             });
             if (loginError) {
                 console.error(`Could not login to get ID: ${loginError.message}`);
                 return;
             }
             authData.user = loginData.user;
        } else {
            console.error(`Auth Error: ${authError.message}`);
            return;
        }
    }

    const newId = authData.user?.id;
    if (!newId) {
        console.error('Failed to get New Auth ID');
        return;
    }
    console.log(`Auth User Ready. New ID: ${newId}`);

    // 3. Update public.users
    // If we have an Old ID and it differs from New ID, we need to migrate.
    if (oldId && oldId !== newId) {
        console.log(`Migrating ID from ${oldId} to ${newId}...`);
        
        // Update public.users ID
        // Note: This might fail if New ID row was already created by a Trigger!
        // Check if New ID row exists
        const { data: newUserRow } = await supabase.from('users').select('*').eq('id', newId).single();
        
        if (newUserRow) {
            console.log('Row for New ID already exists (Trigger?). Merging...');
            // We should delete the Old ID row and move children to New ID
            // Or copy data from Old to New
            await supabase.from('users').update({
                role: 'superadmin',
                name: oldUser.name,
                is_active: true
            }).eq('id', newId);
            
            // Delete old row to avoid confusion?
            // await supabase.from('users').delete().eq('id', oldId); 
            // Better to keep it for now or just update children
        } else {
            // Update Old Row to New ID
            const { error: updateIdError } = await supabase
                .from('users')
                .update({ id: newId, role: 'superadmin' })
                .eq('id', oldId);
                
            if (updateIdError) console.error(`Error updating public.users ID: ${updateIdError.message}`);
            else console.log('Updated public.users ID successfully.');
        }

        // 4. Update Child Tables
        for (const table of USER_TABLES) {
            // Check if table has user_id column
            // We assume column name is 'user_id' or similar. 
            // Adjust based on schema. Most used 'user_id'.
            // exceptions: 'stock_opname_sessions' -> 'created_by'? 'payments' -> 'created_by'?
            
            let col = 'user_id';
            if (table === 'stock_opname_sessions' || table === 'payments') col = 'created_by';
            if (table === 'stock_opname_approvals') col = 'approver_id';
            if (table === 'order_items') col = 'price_change_by'; // edge case
            
            // We'll try generic update
            const { count, error: childError } = await supabase
                .from(table)
                .update({ [col]: newId })
                .eq(col, oldId)
                .select('*', { count: 'exact' });

            if (!childError && count > 0) {
                console.log(`Updated ${count} rows in ${table}.${col}`);
            }
        }
    } else if (!oldId) {
        // No old user, just ensure new user has role
        await supabase.from('users').update({ role: 'superadmin' }).eq('id', newId);
        console.log('New user setup complete.');
    } else {
        console.log('IDs match. No migration needed.');
        await supabase.from('users').update({ role: 'superadmin' }).eq('id', newId);
    }
    
    console.log(`\nDone. Login with: ${email} / ${password}`);
}

(async () => {
    await fixUser('fakhrul@ternakmart.com', 'password123');
    // Also ensuring dapurlaborasi is set
    await fixUser('fakhrul@dapurlaborasi.com', 'password123');
})();
