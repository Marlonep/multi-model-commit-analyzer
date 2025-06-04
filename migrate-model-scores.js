#!/usr/bin/env node

// Migration script to extract model scores from originalData to model_scores column
// This should be run when the server is not running to avoid database locks

console.log('🔄 Starting model scores migration...');
console.log('⚠️  Make sure the server is stopped before running this script!');

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create/open database
const dbPath = path.join(__dirname, 'commit_analyzer.db');

try {
    const db = new Database(dbPath);

    // Check if the column exists
    const columnExists = db.prepare(`
        SELECT COUNT(*) as count 
        FROM pragma_table_info('commits') 
        WHERE name = 'model_scores'
    `).get();

    if (columnExists.count === 0) {
        console.log('📝 Adding model_scores column...');
        db.exec('ALTER TABLE commits ADD COLUMN model_scores TEXT');
        console.log('✅ Added model_scores column to commits table');
    } else {
        console.log('ℹ️  model_scores column already exists');
    }

    // Get all commits with analysis_details that have originalData
    const commits = db.prepare(`
        SELECT id, analysis_details 
        FROM commits 
        WHERE analysis_details IS NOT NULL 
        AND analysis_details LIKE '%originalData%'
    `).all();
    
    console.log(`📊 Found ${commits.length} commits with analysis data containing originalData`);

    if (commits.length === 0) {
        console.log('ℹ️  No commits found with originalData to migrate');
        db.close();
        return;
    }

    // Update commits with extracted model scores
    const updateStmt = db.prepare('UPDATE commits SET model_scores = ? WHERE id = ?');
    let migratedCount = 0;

    for (const commit of commits) {
        try {
            const analysisDetails = JSON.parse(commit.analysis_details);
            const modelScores = analysisDetails.originalData?.modelScores;
            
            if (modelScores && Array.isArray(modelScores) && modelScores.length > 0) {
                updateStmt.run(JSON.stringify(modelScores), commit.id);
                migratedCount++;
                console.log(`✓ Migrated commit ${commit.id} with ${modelScores.length} model scores`);
            }
        } catch (error) {
            console.error(`Error processing commit ${commit.id}:`, error.message);
        }
    }

    console.log(`\n✅ Migration completed: ${migratedCount} commits updated with model scores`);

    db.close();
    console.log('\n🎉 Model scores migration completed successfully!');
    console.log('You can now restart the server.');

} catch (error) {
    if (error.code === 'SQLITE_BUSY') {
        console.error('\n❌ Database is locked. Please stop the server first and try again.');
        console.error('   Run: ps aux | grep "node server.js" | grep -v grep');
        console.error('   Then: kill <PID>');
        process.exit(1);
    } else {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}