import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getAllGitCommits() {
    const { stdout } = await execAsync('git log --format="%H|%an|%ae|%at|%s" --no-merges');
    return stdout.trim().split('\n').map(line => {
        const [hash, author, email, timestamp, ...messageParts] = line.split('|');
        return {
            hash,
            author,
            email,
            timestamp: new Date(parseInt(timestamp) * 1000),
            message: messageParts.join('|')
        };
    });
}

async function getAnalyzedCommits() {
    try {
        const data = await fs.readFile('commit_analysis_history.json', 'utf8');
        const commits = JSON.parse(data);
        return new Set(commits.map(c => c.commitHash));
    } catch (error) {
        return new Set();
    }
}

async function analyzeAllMissingCommits() {
    console.log('🔍 Checking for missing commits...\n');
    
    const allCommits = await getAllGitCommits();
    const analyzedCommits = await getAnalyzedCommits();
    
    const missingCommits = allCommits.filter(commit => 
        !analyzedCommits.has(commit.hash)
    );
    
    console.log(`📊 Total commits in repository: ${allCommits.length}`);
    console.log(`✅ Already analyzed: ${analyzedCommits.size}`);
    console.log(`❗ Missing commits: ${missingCommits.length}\n`);
    
    if (missingCommits.length === 0) {
        console.log('All commits have been analyzed! 🎉');
        return;
    }
    
    console.log('Missing commits to analyze:');
    missingCommits.forEach((commit, index) => {
        console.log(`${index + 1}. ${commit.hash.substring(0, 7)} - ${commit.message} (${commit.author})`);
    });
    
    console.log('\n🚀 Starting analysis of missing commits...\n');
    
    // Analyze each missing commit
    for (const commit of missingCommits) {
        console.log(`\n📝 Analyzing commit ${commit.hash.substring(0, 7)} - ${commit.message}`);
        
        try {
            // Run the analyzer for this specific commit
            const { stdout, stderr } = await execAsync(
                `git checkout ${commit.hash} && node analyzeCommit.js --single-commit ${commit.hash}`,
                { cwd: __dirname }
            );
            
            if (stderr) {
                console.error(`Error analyzing commit: ${stderr}`);
            }
            
            console.log('✅ Analysis complete for this commit');
        } catch (error) {
            console.error(`❌ Failed to analyze commit ${commit.hash}: ${error.message}`);
        }
    }
    
    // Return to main branch
    await execAsync('git checkout main');
    console.log('\n✅ All missing commits have been processed!');
}

// Run the analysis
analyzeAllMissingCommits().catch(console.error);