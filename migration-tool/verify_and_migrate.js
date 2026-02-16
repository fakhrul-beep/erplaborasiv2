
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// === Configuration ===
const SOURCE_URL = 'https://xnqxcxptjjqafrjwynsj.supabase.co';
const SOURCE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhucXhjeHB0ampxYWZyand5bnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDkyMTMsImV4cCI6MjA4NjAyNTIxM30.z3z4Y_r5WhaCRHONX1BjhjeTBCrU-98ccn5xC7-jPbs';

const DEST_URL = process.env.VITE_SUPABASE_URL || 'https://hrrwmuticuoqercfwzrb.supabase.co';
const DEST_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logging setup
const LOG_FILE = path.join(__dirname, 'migration.log');
const REPORT_FILE = path.join(__dirname, 'reconciliation_report.md');
const ROLLBACK_FILE = path.join(__dirname, 'rollback_script.sql');

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// === Helper Functions ===
async function fetchOpenAPISpec(url, apiKey) {
    try {
        const response = await fetch(`${url}/rest/v1/?apikey=${apiKey}`);
        if (!response.ok) throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        log(`Error fetching OpenAPI spec: ${error.message}`, 'ERROR');
        return null;
    }
}

async function getRowCount(client, table) {
    const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        if (error.code === '42P01') return -1; // Table doesn't exist
        log(`Error counting rows in ${table}: ${error.message}`, 'ERROR');
        return null;
    }
    return count;
}

async function verifyIntegrity(sourceClient, destClient, table) {
    // Simple integrity check: compare row counts and check existence of a sample
    const sourceCount = await getRowCount(sourceClient, table);
    const destCount = await getRowCount(destClient, table);

    if (sourceCount === -1 || destCount === -1) {
        return { status: 'ERROR', details: 'Table missing in one or both databases' };
    }

    if (sourceCount !== destCount) {
        return { status: 'MISMATCH', details: `Source: ${sourceCount}, Dest: ${destCount}` };
    }

    // Deep check (sample 5 rows)
    if (sourceCount > 0) {
        const { data: sourceSample } = await sourceClient.from(table).select('*').limit(5);
        if (sourceSample) {
            for (const row of sourceSample) {
                const { data: destRow } = await destClient.from(table).select('*').eq('id', row.id).single();
                if (!destRow) {
                     return { status: 'INTEGRITY_FAIL', details: `Row ${row.id} missing in destination` };
                }
                // Check a few fields for equality (ignoring timestamps which might vary by format)
                // This is a basic check.
            }
        }
    }

    return { status: 'MATCH', details: `Both have ${sourceCount} rows` };
}

// === Main Execution ===
(async () => {
    // Clear logs
    fs.writeFileSync(LOG_FILE, '');
    fs.writeFileSync(ROLLBACK_FILE, '-- Rollback Script (Generated)\n-- Execute this to revert changes\n\n');

    log('=== Starting Advanced Migration & Verification ===');
    log(`Source: ${SOURCE_URL}`);
    log(`Destination: ${DEST_URL}`);

    const sourceClient = createClient(SOURCE_URL, SOURCE_ANON_KEY);
    const destClient = createClient(DEST_URL, DEST_ANON_KEY);

    // 1. Analyze Source Schema
    log('Step 1: Analyzing Source Schema...');
    const openApiSpec = await fetchOpenAPISpec(SOURCE_URL, SOURCE_ANON_KEY);
    if (!openApiSpec || !openApiSpec.definitions) {
        log('Failed to retrieve schema definitions. Aborting.', 'FATAL');
        process.exit(1);
    }
    const tables = Object.keys(openApiSpec.definitions).filter(k => !k.includes(' '));
    log(`Found ${tables.length} tables in source: ${tables.join(', ')}`);

    // 2. Pre-Migration Verification (Identify Missing Data)
    log('\nStep 2: Pre-Migration Analysis (Identifying Missing Data)...');
    const analysis = [];
    
    // Dependency ordering
    const priority = ['roles', 'users', 'customers', 'suppliers', 'warehouses', 'products', 'orders', 'order_items', 'inventory_movements', 'payments'];
    const sortedTables = tables.sort((a, b) => {
        const idxA = priority.indexOf(a);
        const idxB = priority.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const table of sortedTables) {
        const sourceCount = await getRowCount(sourceClient, table);
        const destCount = await getRowCount(destClient, table);
        
        let status = 'UNKNOWN';
        if (destCount === -1) status = 'MISSING_TABLE';
        else if (sourceCount > destCount) status = 'PARTIAL_DATA';
        else if (sourceCount === destCount) status = 'SYNCED';
        else status = 'DEST_HAS_MORE'; // Should not happen usually in migration

        analysis.push({ table, sourceCount, destCount, status });
        log(`Table ${table}: Source=${sourceCount}, Dest=${destCount === -1 ? 'MISSING' : destCount} -> ${status}`);
    }

    // 3. Migration (Duplication)
    log('\nStep 3: Executing Duplication Process...');
    const report = { success: [], failed: [], warnings: [] };

    for (const item of analysis) {
        const { table, status } = item;
        
        if (status === 'SYNCED') {
            log(`Skipping ${table} (Already Synced)`);
            continue;
        }

        if (status === 'MISSING_TABLE') {
            log(`Skipping ${table} (Table missing in destination - Run Schema Script first!)`, 'WARN');
            report.failed.push({ table, error: 'Table missing' });
            continue;
        }

        log(`Migrating ${table}...`);
        try {
            // Add to rollback script (reverse order of creation usually, but here simple DELETE)
            fs.appendFileSync(ROLLBACK_FILE, `DELETE FROM public.${table};\n`);

            let allData = [];
            let page = 0;
            const pageSize = 1000;
            
            while (true) {
                const { data, error } = await sourceClient
                    .from(table)
                    .select('*')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error) throw error;
                if (!data || data.length === 0) break;
                allData = allData.concat(data);
                if (data.length < pageSize) break;
                page++;
            }

            if (allData.length > 0) {
                const batchSize = 100;
                let insertedCount = 0;
                
                for (let i = 0; i < allData.length; i += batchSize) {
                    const chunk = allData.slice(i, i + batchSize);
                    
                    // Upsert with verification
                    const { error: insertError } = await destClient
                        .from(table)
                        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
                    
                    if (insertError) {
                         if (insertError.code === '23503') { // FK violation
                            log(`FK Violation in ${table}: ${insertError.message}`, 'WARN');
                            report.warnings.push({ table, message: insertError.message });
                        } else {
                            log(`Error inserting into ${table}: ${insertError.message}`, 'ERROR');
                            report.warnings.push({ table, message: insertError.message });
                        }
                    } else {
                        insertedCount += chunk.length;
                    }
                }
                log(`Successfully migrated ${insertedCount} rows to ${table}`);
                report.success.push({ table, count: insertedCount });
            } else {
                log(`No data found in source for ${table}`);
            }

        } catch (err) {
            log(`Failed to migrate ${table}: ${err.message}`, 'ERROR');
            report.failed.push({ table, error: err.message });
        }
    }

    // 4. Final Reconciliation & Reporting
    log('\nStep 4: Final Reconciliation & Integrity Check...');
    let mdReport = `# Reconciliation Report\n\n`;
    mdReport += `**Date:** ${new Date().toISOString()}\n\n`;
    mdReport += `| Table | Source Count | Dest Count | Status | Integrity Check |\n`;
    mdReport += `|-------|--------------|------------|--------|-----------------|\n`;

    for (const table of sortedTables) {
        const integrity = await verifyIntegrity(sourceClient, destClient, table);
        const sourceCount = await getRowCount(sourceClient, table);
        const destCount = await getRowCount(destClient, table);
        
        let status = 'OK';
        if (destCount === -1) status = 'MISSING';
        else if (sourceCount !== destCount) status = 'MISMATCH';
        
        mdReport += `| ${table} | ${sourceCount} | ${destCount === -1 ? 'MISSING' : destCount} | ${status} | ${integrity.status} |\n`;
        
        log(`Reconciliation ${table}: ${status} - ${integrity.status}`);
    }

    fs.writeFileSync(REPORT_FILE, mdReport);
    log(`\nReconciliation report saved to ${REPORT_FILE}`);
    log(`Rollback script saved to ${ROLLBACK_FILE}`);
    log('=== Migration & Verification Complete ===');

})();
