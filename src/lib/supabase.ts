import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnqxcxptjjqafrjwynsj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhucXhjeHB0ampxYWZyand5bnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDkyMTMsImV4cCI6MjA4NjAyNTIxM30.z3z4Y_r5WhaCRHONX1BjhjeTBCrU-98ccn5xC7-jPbs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
