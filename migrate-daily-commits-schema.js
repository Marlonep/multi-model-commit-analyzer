#!/usr/bin/env node

// Migration script to add missing columns to daily_commits table
// Run this when the server is stopped

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Starting daily_commits schema migration...');
console.log('⚠️  Make sure the server is stopped before running this script!');

try {
    const dbPath = path.join(__dirname, 'commit_analyzer.db');
    const db = new Database(dbPath);

    // List of columns to add
    const columnsToAdd = [
        { name: 'average_dev_level', type: 'REAL DEFAULT 0' },
        { name: 'projects', type: 'TEXT DEFAULT \'[]\'' },
        { name: 'commit_hashes', type: 'TEXT DEFAULT \'[]\'' },
        { name: 'commit_indices', type: 'TEXT DEFAULT \'[]\'' }
    ];

    for (const column of columnsToAdd) {
        try {
            // Check if column exists
            const columnExists = db.prepare(`
                SELECT COUNT(*) as count 
                FROM pragma_table_info('daily_commits') 
                WHERE name = '${column.name}'
            `).get();
            
            if (columnExists.count === 0) {
                console.log(`📝 Adding column: ${column.name}`);
                db.exec(`ALTER TABLE daily_commits ADD COLUMN ${column.name} ${column.type}`);
                console.log(`✅ Added ${column.name} column`);
            } else {
                console.log(`ℹ️  Column ${column.name} already exists`);
            }
        } catch (error) {
            console.error(`❌ Error adding column ${column.name}:`, error.message);
        }
    }

    // Verify final schema
    console.log('\n📊 Final daily_commits table schema:');
    const schema = db.prepare('PRAGMA table_info(daily_commits)').all();
    schema.forEach(col => {
        console.log(`  ${col.name} (${col.type})`);
    });

    db.close();
    console.log('\n🎉 Schema migration completed successfully!');
    console.log('You can now restart the server.');

} catch (error) {
    if (error.code === 'SQLITE_BUSY') {
        console.error('\n❌ Database is locked. Please stop the server and any database tools first.');
        console.error('   1. Stop server: ps aux | grep "node server.js" | grep -v grep | awk \'{print $2}\' | xargs kill');
        console.error('   2. Close DB browser or any SQLite tools');
        console.error('   3. Run this script again');
        process.exit(1);
    } else {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}