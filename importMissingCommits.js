import { exec } from 'child_process';
import { promisify } from 'util';
import db from './database.js';

const execAsync = promisify(exec);

// Get project configuration
const projectConfig = {
    project: 'multi-model-commit-analyzer',
    organization: 'Nuclea-Solutions',
    user: 'mario01nuclea'
};

async function getAllGitCommits() {
    const { stdout } = await execAsync('git log --format="%H" --no-merges');
    return stdout.trim().split('\n');
}

async function getExistingCommitHashes() {
    const result = db.prepare('SELECT commit_hash FROM commits').all();
    return new Set(result.map(r => r.commit_hash));
}

async function importCommit(hash) {
    try {
        // Get commit details
        const { stdout: commitInfo } = await execAsync(`git show --format="%an|%ae|%at|%s" -s ${hash}`);
        const [author, email, timestamp, ...messageParts] = commitInfo.trim().split('|');
        const message = messageParts.join('|');
        
        // Count changes
        const { stdout: stats } = await execAsync(`git show --stat ${hash} --format=""`);
        const lines = stats.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const filesChanged = lines.length - 1;
        
        let linesAdded = 0;
        let linesDeleted = 0;
        
        const match = lastLine.match(/(\d+) insertions?\(\+\)(?:, (\d+) deletions?\(-\))?/);
        if (match) {
            linesAdded = parseInt(match[1]) || 0;
            linesDeleted = parseInt(match[2]) || 0;
        }
        
        // Insert into database with basic scores (will be analyzed later)
        const stmt = db.prepare(`
            INSERT INTO commits (
                commit_hash, user_name, project, organization, commit_message, 
                timestamp, file_changes, lines_added, lines_deleted,
                average_code_quality, average_dev_level, average_complexity,
                average_estimated_hours, average_ai_percentage, total_cost,
                tokens_used, status, analysis_details
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `);
        
        // Calculate basic estimated hours based on lines changed
        const totalLines = linesAdded + linesDeleted;
        const estimatedHours = Math.max(0.5, totalLines / 50); // Rough estimate: 50 lines per hour
        
        stmt.run(
            hash,
            author,
            projectConfig.project,
            projectConfig.organization,
            message,
            new Date(parseInt(timestamp) * 1000).toISOString(),
            filesChanged,
            linesAdded,
            linesDeleted,
            5.0, // Default quality score
            5.0, // Default dev level
            5.0, // Default complexity
            estimatedHours,
            0, // Default AI percentage
            0, // No cost for manual import
            0, // No tokens used
            'ok', // Status
            JSON.stringify({ note: 'Imported without AI analysis' }) // Analysis details
        );
        
        return {
            hash,
            message,
            author,
            success: true
        };
        
    } catch (error) {
        console.error(`Error importing commit ${hash}:`, error.message);
        return {
            hash,
            success: false,
            error: error.message
        };
    }
}

async function importMissingCommits() {
    console.log('🔍 Checking for missing commits...\n');
    
    const allCommitHashes = await getAllGitCommits();
    const existingHashes = await getExistingCommitHashes();
    
    const missingHashes = allCommitHashes.filter(hash => !existingHashes.has(hash));
    
    console.log(`📊 Total commits in repository: ${allCommitHashes.length}`);
    console.log(`✅ Already in database: ${existingHashes.size}`);
    console.log(`❗ Missing commits: ${missingHashes.length}\n`);
    
    if (missingHashes.length === 0) {
        console.log('All commits are already imported! 🎉');
        return;
    }
    
    console.log('Importing missing commits...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < missingHashes.length; i++) {
        const hash = missingHashes[i];
        console.log(`[${i + 1}/${missingHashes.length}] Importing ${hash.substring(0, 7)}...`);
        
        const result = await importCommit(hash);
        
        if (result.success) {
            successCount++;
            console.log(`  ✅ ${result.message} (by ${result.author})`);
        } else {
            errorCount++;
            console.log(`  ❌ Failed: ${result.error}`);
        }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Successfully imported: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    
    // Check new total
    const newTotal = db.prepare('SELECT COUNT(*) as count FROM commits').get();
    console.log(`  📁 Total commits in database: ${newTotal.count}`);
    
    console.log('\n💡 Note: These commits were imported without AI analysis.');
    console.log('To analyze them with AI later, set OPENAI_API_KEY and run the analysis tool.');
}

// Run the import
importMissingCommits().catch(console.error);