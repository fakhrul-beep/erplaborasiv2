
import { createClient } from '@supabase/supabase-js';

const DEST_URL = process.env.VITE_SUPABASE_URL || 'https://hrrwmuticuoqercfwzrb.supabase.co';
const DEST_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

const supabase = createClient(DEST_URL, DEST_ANON_KEY);

const password = 'password123';

async function fixUser(email) {
    console.log(`\n------------------------------------------------`);
    console.log(`Processing ${email}...`);

    // 1. Try to Login first (to get ID if user exists)
    let userId = null;
    let authUser = null;

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (loginData?.user) {
        console.log(`[OK] Logged in successfully.`);
        authUser = loginData.user;
        userId = authUser.id;
    } else {
        console.log(`[INFO] Login failed (${loginError?.message}). Attempting Sign Up...`);
        
        // 2. Sign Up if not logged in
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: email.split('@')[0],
                    role: 'superadmin'
                }
            }
        });

        if (signUpError) {
            console.error(`[ERROR] Sign Up Failed: ${signUpError.message}`);
            if (signUpError.message.includes('rate limit')) {
                console.warn('Rate limit hit. Please wait 60 seconds before retrying.');
            }
            return;
        }

        if (signUpData?.user) {
            console.log(`[OK] Sign Up Successful.`);
            authUser = signUpData.user;
            userId = authUser.id;
        }
    }

    if (!userId) {
        console.error('[ERROR] Could not obtain User ID. Aborting for this user.');
        return;
    }

    console.log(`Auth User ID: ${userId}`);

    // 3. Ensure public.users profile exists and is correct
    // Check if profile exists with this ID
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error(`[ERROR] Checking profile: ${profileError.message}`);
    }

    if (profile) {
        console.log(`[INFO] Profile exists. Updating role to superadmin...`);
        const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'superadmin', is_active: true })
            .eq('id', userId);
        
        if (updateError) console.error(`[ERROR] Updating role: ${updateError.message}`);
        else console.log(`[OK] Role updated.`);
    } else {
        console.log(`[INFO] Profile missing. Creating new profile...`);
        // Check if there is a profile with the same email but DIFFERENT ID (Old Migration Data)
        const { data: oldProfile } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .neq('id', userId) // Don't match the current ID
            .single();

        if (oldProfile) {
            console.log(`[WARN] Found OLD profile with ID ${oldProfile.id}. Deleting it to avoid conflict...`);
            // We delete the old one and create a new one with the correct ID
            await supabase.from('users').delete().eq('id', oldProfile.id);
        }

        const { error: insertError } = await supabase
            .from('users')
            .insert({
                id: userId,
                email: email,
                role: 'superadmin',
                name: email.split('@')[0],
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (insertError) console.error(`[ERROR] Creating profile: ${insertError.message}`);
        else console.log(`[OK] Profile created successfully.`);
    }
}

(async () => {
    // Process sequentially to avoid rate limits if possible? No, rate limit is per IP/endpoint.
    // We'll try one by one.
    await fixUser('fakhrul@dapurlaborasi.com');
    
    // Small delay just in case
    await new Promise(r => setTimeout(r, 2000));
    
    await fixUser('fakhrul@ternakmart.com');
})();
