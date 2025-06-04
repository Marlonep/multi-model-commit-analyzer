#!/usr/bin/env node

// Complete setup script for daily commits functionality
// This script will:
// 1. Add missing columns to daily_commits table
// 2. Clear existing daily_commits data  
// 3. Generate fresh daily reports from commits data

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDailyReport } from './generateDailyReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Setting up daily commits functionality...');
console.log('⚠️  Make sure the server is stopped and DB Browser is closed!');

try {
    const dbPath = path.join(__dirname, 'commit_analyzer.db');
    const db = new Database(dbPath);

    console.log('\n📝 Step 1: Adding missing columns to daily_commits table...');
    
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
                console.log(`  Adding column: ${column.name}`);
                db.exec(`ALTER TABLE daily_commits ADD COLUMN ${column.name} ${column.type}`);
                console.log(`  ✅ Added ${column.name} column`);
            } else {
                console.log(`  ℹ️  Column ${column.name} already exists`);
            }
        } catch (error) {
            console.error(`  ❌ Error adding column ${column.name}:`, error.message);
        }
    }

    console.log('\n🗑️  Step 2: Clearing existing daily_commits data...');
    const deleteResult = db.prepare('DELETE FROM daily_commits').run();
    console.log(`  ✅ Deleted ${deleteResult.changes} existing daily commit records`);

    console.log('\n📊 Final daily_commits table schema:');
    const schema = db.prepare('PRAGMA table_info(daily_commits)').all();
    schema.forEach(col => {
        console.log(`  ${col.name} (${col.type})`);
    });

    // Check total commits available
    const totalCommits = db.prepare('SELECT COUNT(*) as count FROM commits').get();
    console.log(`\n📈 Found ${totalCommits.count} commits in database to process`);

    db.close();

    console.log('\n⚡ Step 3: Generating fresh daily reports...');
    
    // Generate reports for all dates (no specific date = process all)
    const result = await generateDailyReport(null);
    
    if (result.success) {
        console.log('\n🎉 Daily commits setup completed successfully!');
        console.log(`   - Days processed: ${result.daysProcessed}`);
        console.log(`   - Records saved: ${result.recordsSaved}`);
        console.log(`   - Commits analyzed: ${result.commitsAnalyzed}`);
        console.log('\nYou can now restart the server and test the daily commits functionality.');
    } else {
        console.error('\n❌ Daily report generation failed:', result.error);
        process.exit(1);
    }

} catch (error) {
    if (error.code === 'SQLITE_BUSY') {
        console.error('\n❌ Database is locked. Please:');
        console.error('   1. Stop the server: ps aux | grep "node server.js" | grep -v grep | awk \'{print $2}\' | xargs kill');
        console.error('   2. Close DB Browser or any SQLite tools');
        console.error('   3. Run this script again: node setup-daily-commits.js');
        process.exit(1);
    } else {
        console.error('\n❌ Setup failed:', error.message);
        process.exit(1);
    }
}