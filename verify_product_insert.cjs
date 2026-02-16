
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xnqxcxptjjqafrjwynsj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhucXhjeHB0ampxYWZyand5bnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDkyMTMsImV4cCI6MjA4NjAyNTIxM30.z3z4Y_r5WhaCRHONX1BjhjeTBCrU-98ccn5xC7-jPbs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyProductInsert() {
  const testProduct = {
    name: 'Test Product ' + Date.now(),
    sku: 'TEST-SKU-' + Date.now(),
    description: 'Test Description',
    unit_price: 100.50, // TRYING INCORRECT COLUMN
    stock_quantity: 10,
    category: 'Test',
    type: 'equipment'
  };

  console.log('Attempting to insert product with `price` column...');
  
  const { data, error } = await supabase
    .from('products')
    .insert([testProduct])
    .select();

  if (error) {
    console.error('Insert failed:', error);
    process.exit(1);
  } else {
    console.log('Insert successful!', data);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', data[0].id);
      
    if (deleteError) {
      console.error('Cleanup failed:', deleteError);
    } else {
      console.log('Cleanup successful (deleted test product).');
    }
    process.exit(0);
  }
}

verifyProductInsert();
