
import { createClient } from '@supabase/supabase-js';

const DEST_URL = process.env.VITE_SUPABASE_URL || 'https://hrrwmuticuoqercfwzrb.supabase.co';
const DEST_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

const supabase = createClient(DEST_URL, DEST_ANON_KEY);

(async () => {
  console.log('Checking existing users in public.users...');
  const { data: users, error } = await supabase.from('users').select('*');
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} users in public.users:`);
  users.forEach(u => console.log(`- ${u.email} (ID: ${u.id}, Role: ${u.role})`));

  const targetUsers = ['fakhrul@dapurlaborasi.com', 'fakhrul@ternakart.com'];
  
  for (const email of targetUsers) {
    console.log(`\nAttempting to register/login ${email}...`);
    
    // Attempt sign up with a known password
    const password = 'password123';
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: email.split('@')[0],
          role: 'superadmin' // Trying to pass role in metadata
        }
      }
    });

    if (authError) {
      console.error(`Auth Error for ${email}:`, authError.message);
      // If user already registered, try sign in?
      if (authError.message.includes('User already registered')) {
          console.log('User exists in Auth system. Password mismatch?');
      }
    } else {
      console.log(`Auth Success for ${email}: ID=${authData.user?.id}`);
      
      // Update public.users role if needed
      if (authData.user) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'superadmin', is_active: true })
          .eq('email', email); // Match by email since ID might differ? Or should match by ID?
          
        if (updateError) console.error('Error updating role:', updateError);
        else console.log('Updated role to superadmin in public.users');
      }
    }
  }
})();
