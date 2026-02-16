
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// === Configuration ===
const SOURCE_URL = 'https://xnqxcxptjjqafrjwynsj.supabase.co';
const SOURCE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhucXhjeHB0ampxYWZyand5bnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDkyMTMsImV4cCI6MjA4NjAyNTIxM30.z3z4Y_r5WhaCRHONX1BjhjeTBCrU-98ccn5xC7-jPbs';

// Destination: Use environment variables or defaults
const DEST_URL = process.env.VITE_SUPABASE_URL || 'https://hrrwmuticuoqercfwzrb.supabase.co';
const DEST_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Helper Functions ===
async function fetchOpenAPISpec(url, apiKey) {
  try {
    const response = await fetch(`${url}/rest/v1/?apikey=${apiKey}`);
    if (!response.ok) throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching OpenAPI spec:', error.message);
    return null;
  }
}

function generateDDL(definitions) {
  let sql = '-- Generated Schema Migration Script\n';
  sql += '-- Run this in the Destination Supabase SQL Editor to create tables.\n\n';
  
  for (const [tableName, schema] of Object.entries(definitions)) {
    if (!schema.properties) continue;

    sql += `-- Table: ${tableName}\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
    
    const columns = [];
    
    for (const [colName, colSchema] of Object.entries(schema.properties)) {
      let colDef = `  "${colName}" `;
      
      switch (colSchema.type) {
        case 'integer': colDef += 'INTEGER'; break;
        case 'number': colDef += 'NUMERIC'; break;
        case 'boolean': colDef += 'BOOLEAN'; break;
        case 'string': 
          if (colSchema.format === 'date-time') colDef += 'TIMESTAMPTZ';
          else if (colSchema.format === 'uuid') colDef += 'UUID';
          else colDef += 'TEXT';
          break;
        default: colDef += 'JSONB';
      }
      
      // Attempt to infer Primary Key (usually 'id')
      if (colName === 'id' && colSchema.format === 'uuid') {
          colDef += ' PRIMARY KEY DEFAULT gen_random_uuid()';
      }
      
      columns.push(colDef);
    }
    
    sql += columns.join(',\n');
    sql += '\n);\n\n';
    
    // Enable RLS by default for security
    sql += `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;
  }
  return sql;
}

async function migrateData(sourceClient, destClient, tables) {
  const report = { success: [], failed: [], warnings: [] };
  
  // Dependency ordering (manual heuristic to minimize FK errors)
  const priority = ['roles', 'users', 'customers', 'suppliers', 'warehouses', 'products', 'orders', 'order_items', 'inventory_movements', 'payments'];
  
  // Sort tables based on priority
  const sortedTables = tables.sort((a, b) => {
    const idxA = priority.indexOf(a);
    const idxB = priority.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  console.log(`Starting data migration sequence: ${sortedTables.join(' -> ')}`);

  for (const table of sortedTables) {
    console.log(`Migrating table: ${table}...`);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await sourceClient
          .from(table)
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);
          
        if (error) {
            console.warn(`  Warning: Could not fetch from ${table} (Reason: ${error.message}). Skipping.`);
            report.warnings.push({ table, message: error.message });
            break; 
        }
        
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        page++;
      }

      console.log(`  Fetched ${allData.length} rows from ${table}`);
      
      if (allData.length > 0) {
        const batchSize = 100;
        let insertedCount = 0;
        
        for (let i = 0; i < allData.length; i += batchSize) {
            const chunk = allData.slice(i, i + batchSize);
            
            // Upsert chunk
            const { error: insertError } = await destClient
                .from(table)
                .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true }); // Ignore duplicates to prevent hard failure
            
            if (insertError) {
                if (insertError.code === '23503') { // FK violation
                    report.warnings.push({ table, message: `FK Violation: ${insertError.message}` });
                    console.warn(`  Warning: FK Violation in ${table}. Skipping batch.`);
                } else if (insertError.code === '42P01') { // Undefined table
                    report.failed.push({ table, error: `Table '${table}' does not exist in destination.` });
                    console.error(`  Error: Table '${table}' missing in destination.`);
                    break;
                } else {
                    report.warnings.push({ table, message: insertError.message });
                    console.warn(`  Warning: Insert error in ${table}: ${insertError.message}`);
                }
            } else {
                insertedCount += chunk.length;
            }
        }
        console.log(`  Successfully migrated ${insertedCount}/${allData.length} rows.`);
        report.success.push({ table, count: insertedCount });
      } else {
        report.success.push({ table, count: 0 });
      }

    } catch (err) {
      console.error(`  Failed to migrate ${table}:`, err.message);
      report.failed.push({ table, error: err.message });
    }
  }
  
  return report;
}

// === Main Execution ===
(async () => {
  console.log('=== Supabase Migration Tool ===');
  console.log('Source:', SOURCE_URL);
  console.log('Destination:', DEST_URL);
  
  // 1. Setup Clients
  const sourceClient = createClient(SOURCE_URL, SOURCE_ANON_KEY);
  const destClient = createClient(DEST_URL, DEST_ANON_KEY);
  
  // 2. Fetch Schema Info
  console.log('\nStep 1: Fetching Schema Information...');
  const openApiSpec = await fetchOpenAPISpec(SOURCE_URL, SOURCE_ANON_KEY);
  
  if (!openApiSpec || !openApiSpec.definitions) {
    console.error('Failed to retrieve schema definitions. Aborting.');
    process.exit(1);
  }
  
  const tables = Object.keys(openApiSpec.definitions).filter(k => !k.includes(' '));
  console.log(`Found ${tables.length} tables:`, tables.join(', '));
  
  // 3. Generate DDL (Schema)
  console.log('\nStep 2: Generating Schema Script...');
  const ddl = generateDDL(openApiSpec.definitions);
  fs.writeFileSync(path.join(__dirname, 'migrated_schema.sql'), ddl);
  console.log('Schema script saved to migration-tool/migrated_schema.sql');

  // 4. Migrate Data
  console.log('\nStep 3: Migrating Data...');
  const report = await migrateData(sourceClient, destClient, tables);
  
  // 5. Generate Report
  const reportPath = path.join(__dirname, 'migration_report.md');
  let mdReport = `# Migration Report\n\n`;
  mdReport += `**Date:** ${new Date().toISOString()}\n`;
  mdReport += `**Source:** ${SOURCE_URL}\n`;
  mdReport += `**Destination:** ${DEST_URL}\n\n`;
  
  mdReport += `## Summary\n`;
  mdReport += `- **Success:** ${report.success.length} tables\n`;
  mdReport += `- **Failed:** ${report.failed.length} tables\n`;
  mdReport += `- **Warnings:** ${report.warnings.length} issues\n\n`;
  
  mdReport += `## Details\n`;
  mdReport += `### Successful Migrations\n`;
  report.success.forEach(item => {
      mdReport += `- **${item.table}**: ${item.count} rows\n`;
  });
  
  if (report.failed.length > 0) {
      mdReport += `\n### Failed Migrations\n`;
      report.failed.forEach(item => {
          mdReport += `- **${item.table}**: ${item.error}\n`;
      });
  }
  
  if (report.warnings.length > 0) {
      mdReport += `\n### Warnings\n`;
      report.warnings.forEach(item => {
          mdReport += `- **${item.table}**: ${item.message}\n`;
      });
  }
  
  fs.writeFileSync(reportPath, mdReport);
  
  console.log('\n=== Migration Complete ===');
  console.log(`Detailed report saved to ${reportPath}`);
  
})();
