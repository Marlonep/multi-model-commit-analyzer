import { execSync } from 'child_process';
import { dbHelpers } from './database.js';

console.log('Importing commits from git history...');

try {
    // Get git log with commit details
    const gitLog = execSync('git log --pretty=format:"%H|%an|%ae|%s|%aI" --numstat', { 
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024  // 50MB buffer
    });
    
    const lines = gitLog.split('\n');
    const commits = [];
    let currentCommit = null;
    
    for (const line of lines) {
        if (line.includes('|')) {
            // This is a commit info line
            if (currentCommit) {
                commits.push(currentCommit);
            }
            
            const [hash, author, email, message, timestamp] = line.split('|');
            currentCommit = {
                commit_hash: hash,
                user_name: author,
                commit_message: message,
                timestamp: timestamp,
                project: 'multi-model-commit-analyzer',
                organization: 'Nuclea-Solutions',
                file_changes: 0,
                lines_added: 0,
                lines_deleted: 0,
                average_code_quality: 3.5,
                average_dev_level: 2.0,
                average_complexity: 3.0,
                average_estimated_hours: 1.0,
                average_estimated_hours_with_ai: 0.5,
                average_ai_percentage: 50,
                total_cost: 0,
                tokens_used: 0,
                status: 'ok',
                manually_reviewed: 0,
                status_log: [],
                analysis_details: {},
                model_scores: []
            };
        } else if (line.trim() && currentCommit) {
            // This is a file change line
            const parts = line.trim().split('\t');
            if (parts.length === 3) {
                const [added, deleted] = parts;
                if (added !== '-' && deleted !== '-') {
                    currentCommit.lines_added += parseInt(added) || 0;
                    currentCommit.lines_deleted += parseInt(deleted) || 0;
                    currentCommit.file_changes++;
                }
            }
        }
    }
    
    if (currentCommit) {
        commits.push(currentCommit);
    }
    
    console.log(`Found ${commits.length} commits to import`);
    
    // Import commits to database
    let imported = 0;
    let skipped = 0;
    
    for (const commit of commits) {
        try {
            // Check if commit already exists
            const existing = dbHelpers.getCommitByHash(commit.commit_hash);
            if (!existing) {
                dbHelpers.createCommit(commit);
                imported++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`Error importing commit ${commit.commit_hash}:`, error.message);
        }
    }
    
    console.log(`\nImport complete!`);
    console.log(`- Imported: ${imported} commits`);
    console.log(`- Skipped (already exist): ${skipped} commits`);
    console.log(`- Total in database now: ${dbHelpers.getAllCommits('admin', 1, 'admin').length} commits`);
    
} catch (error) {
    console.error('Error importing commits:', error);
}

process.exit(0);