import { exec } from 'child_process';
import { promisify } from 'util';
import { dbHelpers } from './database.js';

const execAsync = promisify(exec);

async function getGitCommitHashes() {
    const { stdout } = await execAsync('git log --format="%H" --no-merges');
    return stdout.trim().split('\n');
}

async function getAnalyzedCommitHashes() {
    try {
        // Get commit hashes from SQLite database
        const commits = dbHelpers.getAllCommits('admin', null, null);
        return new Set(commits.map(c => c.commit_hash));
    } catch (error) {
        console.error('Error reading from database:', error);
        return new Set();
    }
}

async function analyzeMissingCommits() {
    console.log('🔍 Scanning for missing commits (GitHub vs Database)...\n');
    
    const allHashes = await getGitCommitHashes();
    const analyzedHashes = await getAnalyzedCommitHashes();
    
    const missingHashes = allHashes.filter(hash => !analyzedHashes.has(hash));
    
    console.log(`📊 Total commits in Git: ${allHashes.length}`);
    console.log(`✅ Already in database: ${analyzedHashes.size}`);
    console.log(`❗ Missing from database: ${missingHashes.length}\n`);
    
    if (missingHashes.length === 0) {
        console.log('✅ All commits have been analyzed and stored in database!');
        return;
    }
    
    // Get commit info for missing commits
    const missingCommits = [];
    for (const hash of missingHashes) {
        try {
            const { stdout } = await execAsync(`git log -1 --format="%h|%s|%an|%ad" ${hash}`);
            const [shortHash, message, author, date] = stdout.trim().split('|');
            missingCommits.push({ hash, shortHash, message, author, date });
        } catch (error) {
            console.warn(`Error getting info for commit ${hash}:`, error.message);
        }
    }
    
    console.log('Missing commits that need to be analyzed:');
    missingCommits.forEach((commit, i) => {
        console.log(`${i + 1}. ${commit.shortHash} - ${commit.message} (${commit.author})`);
    });
    
    console.log('\n🚀 Starting analysis of missing commits...\n');
    
    // Analyze missing commits
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < missingCommits.length; i++) {
        const commit = missingCommits[i];
        console.log(`📝 Analyzing ${i + 1}/${missingCommits.length}: ${commit.shortHash} - ${commit.message}`);
        console.log('================================================================================');
        
        try {
            // Import analyzeCommit function
            const { analyzeCommit } = await import('./analyzeCommit.js');
            await analyzeCommit(commit.hash);
            console.log(`✅ Successfully analyzed ${commit.shortHash}\n`);
            successCount++;
        } catch (error) {
            console.error(`❌ Error analyzing ${commit.shortHash}:`, error.message);
            errorCount++;
        }
    }
    
    console.log('\n🎉 Analysis completed!');
    console.log(`✅ Successfully analyzed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total commits in database: ${analyzedHashes.size + successCount}`);
}

analyzeMissingCommits().catch(console.error);