
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hrrwmuticuoqercfwzrb.supabase.co';
const supabaseAnonKey = 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkConnection() {
  console.log('Checking connection to Supabase...');
  try {
    const { data, error } = await supabase.from('system_settings').select('*').limit(1);
    if (error) {
      console.error('Connection failed:', error.message);
    } else {
      console.log('Connection successful! Data:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkConnection();
