import { exec } from 'child_process';
import { promisify } from 'util';
import db from './database.js';

const execAsync = promisify(exec);

async function getAllGitCommits() {
    const { stdout } = await execAsync('git log --format="%H|%an|%at|%s" --no-merges');
    return stdout.trim().split('\n').map(line => {
        const [hash, author, timestamp, ...messageParts] = line.split('|');
        return {
            hash,
            author,
            timestamp: new Date(parseInt(timestamp) * 1000),
            message: messageParts.join('|')
        };
    });
}

async function getExistingCommitHashes() {
    const result = db.prepare('SELECT commit_hash FROM commits').all();
    return new Set(result.map(r => r.commit_hash));
}

async function checkMissingCommits() {
    console.log('🔍 Checking for missing commits...\n');
    
    const allCommits = await getAllGitCommits();
    const existingHashes = await getExistingCommitHashes();
    
    const missingCommits = allCommits.filter(commit => !existingHashes.has(commit.hash));
    
    console.log(`📊 Total commits in repository: ${allCommits.length}`);
    console.log(`✅ Already in database: ${existingHashes.size}`);
    console.log(`❗ Missing commits: ${missingCommits.length}\n`);
    
    if (missingCommits.length === 0) {
        console.log('All commits are already in the database! 🎉');
        return;
    }
    
    console.log('Missing commits:');
    console.log('================\n');
    
    missingCommits.forEach((commit, i) => {
        console.log(`${i + 1}. ${commit.hash.substring(0, 7)} - ${commit.message}`);
        console.log(`   Author: ${commit.author}`);
        console.log(`   Date: ${commit.timestamp.toLocaleDateString()}\n`);
    });
    
    console.log('\nTo analyze these commits, you need to:');
    console.log('1. Set the OPENAI_API_KEY environment variable');
    console.log('2. Run: node syncMissingCommits.js');
}

// Run the check
checkMissingCommits().catch(console.error);