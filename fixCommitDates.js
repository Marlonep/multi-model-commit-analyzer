import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getGitCommitDate(hash) {
    try {
        const { stdout } = await execAsync(`git log -1 --format=%aI ${hash}`);
        return stdout.trim();
    } catch (error) {
        console.error(`Error getting date for ${hash}: ${error.message}`);
        return null;
    }
}

async function fixCommitDates() {
    console.log('🔧 Fixing commit dates...\n');
    
    // Load the commit analysis history
    const data = await fs.readFile('commit_analysis_history.json', 'utf8');
    const commits = JSON.parse(data);
    
    console.log(`Processing ${commits.length} commits...`);
    
    let updated = 0;
    let failed = 0;
    
    // Update each commit with the correct date
    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const shortHash = commit.commitHash.substring(0, 7);
        
        process.stdout.write(`\r${i + 1}/${commits.length} - Processing ${shortHash}...`);
        
        // Get the real commit date from git
        const gitDate = await getGitCommitDate(commit.commitHash);
        
        if (gitDate) {
            // If we don't have analyzedAt, use the current timestamp as analyzedAt
            if (!commit.analyzedAt) {
                commit.analyzedAt = commit.timestamp;
            }
            
            // Update timestamp to the real git commit date
            const oldDate = new Date(commit.timestamp);
            const newDate = new Date(gitDate);
            
            if (oldDate.toISOString() !== newDate.toISOString()) {
                commit.timestamp = gitDate;
                updated++;
            }
        } else {
            failed++;
        }
    }
    
    console.log(`\n\n✅ Updated ${updated} commit dates`);
    if (failed > 0) {
        console.log(`⚠️  Failed to get dates for ${failed} commits`);
    }
    
    // Save the updated data
    await fs.writeFile(
        'commit_analysis_history.json', 
        JSON.stringify(commits, null, 2)
    );
    
    console.log('\n📊 Sample of updated commits:');
    commits.slice(0, 3).forEach(commit => {
        console.log(`\n${commit.commitHash.substring(0, 7)} - ${commit.commitMessage}`);
        console.log(`  Commit Date: ${new Date(commit.timestamp).toLocaleString()}`);
        console.log(`  Analyzed At: ${new Date(commit.analyzedAt).toLocaleString()}`);
    });
}

fixCommitDates().catch(console.error);