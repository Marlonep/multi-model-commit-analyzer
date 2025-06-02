import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function getGitCommitHashes() {
    const { stdout } = await execAsync('git log --format="%H" --no-merges');
    return stdout.trim().split('\n');
}

async function getAnalyzedCommitHashes() {
    try {
        const data = await fs.readFile('commit_analysis_history.json', 'utf8');
        const commits = JSON.parse(data);
        return new Set(commits.map(c => c.commitHash));
    } catch (error) {
        return new Set();
    }
}

async function analyzeMissingCommits() {
    console.log('🔍 Scanning for missing commits...\n');
    
    const allHashes = await getGitCommitHashes();
    const analyzedHashes = await getAnalyzedCommitHashes();
    
    const missingHashes = allHashes.filter(hash => !analyzedHashes.has(hash));
    
    console.log(`📊 Total commits: ${allHashes.length}`);
    console.log(`✅ Already analyzed: ${analyzedHashes.size}`);
    console.log(`❗ Missing: ${missingHashes.length}\n`);
    
    if (missingHashes.length === 0) {
        console.log('All commits have been analyzed!');
        return;
    }
    
    // Get commit info for missing commits
    const missingCommits = [];
    for (const hash of missingHashes) {
        const { stdout } = await execAsync(`git log -1 --format="%h|%s|%an|%ad" ${hash}`);
        const [shortHash, message, author, date] = stdout.trim().split('|');
        missingCommits.push({ hash, shortHash, message, author, date });
    }
    
    console.log('Missing commits:');
    missingCommits.forEach((commit, i) => {
        console.log(`${i + 1}. ${commit.shortHash} - ${commit.message} (${commit.author})`);
    });
    
    console.log('\n🚀 Starting analysis...\n');
    
    // Analyze each missing commit
    for (let i = 0; i < missingHashes.length; i++) {
        const hash = missingHashes[i];
        const commit = missingCommits[i];
        
        console.log(`\n📝 Analyzing ${i + 1}/${missingHashes.length}: ${commit.shortHash} - ${commit.message}`);
        console.log('=' + '='.repeat(79));
        
        try {
            // Run the analyzer for this specific commit
            await execAsync(`node analyzeCommit.js ${hash}`, { 
                cwd: process.cwd(),
                stdio: 'inherit'
            });
            
            console.log(`✅ Successfully analyzed ${commit.shortHash}`);
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ Failed to analyze ${commit.shortHash}: ${error.message}`);
        }
    }
    
    console.log('\n🎉 All missing commits have been processed!');
}

// Run the analysis
analyzeMissingCommits().catch(console.error);