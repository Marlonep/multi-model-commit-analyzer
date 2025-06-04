import { exec } from 'child_process';
import { promisify } from 'util';
import db from './database.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

async function analyzeCommit(hash) {
    try {
        // Get commit details
        const { stdout: commitInfo } = await execAsync(`git show --format="%an|%ae|%at|%s" -s ${hash}`);
        const [author, email, timestamp, ...messageParts] = commitInfo.trim().split('|');
        const message = messageParts.join('|');
        
        // Get diff
        const { stdout: diff } = await execAsync(`git show ${hash} --format="" --unified=3`);
        
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
        
        // Analyze with GPT-4o-mini
        const analysisPrompt = `Analyze this git commit and provide a detailed technical analysis in JSON format:

Commit Message: ${message}

Diff (first 5000 chars):
${diff.substring(0, 5000)}

Provide analysis with these fields (all numeric values should be 0-10 scale):
{
  "codeQualityScore": <0-10>,
  "devLevelEstimate": <1-10, where 1=beginner, 5=mid, 10=expert>,
  "complexityScore": <0-10>,
  "estimatedHours": <decimal hours>,
  "aiPercentage": <0-100>,
  "explanation": "<brief explanation of scores>"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content);
        
        // Calculate cost (GPT-4o-mini pricing)
        const inputTokens = completion.usage.prompt_tokens;
        const outputTokens = completion.usage.completion_tokens;
        const totalCost = (inputTokens * 0.00015 / 1000) + (outputTokens * 0.0006 / 1000);
        
        // Insert into database
        const stmt = db.prepare(`
            INSERT INTO commits (
                commit_hash, user_name, project, organization, commit_message, 
                timestamp, file_changes, lines_added, lines_deleted,
                average_code_quality, average_dev_level, average_complexity,
                average_estimated_hours, average_ai_percentage, total_cost,
                model_used, prompt_tokens, completion_tokens, analysis_notes
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `);
        
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
            analysis.codeQualityScore || 5,
            analysis.devLevelEstimate || 5,
            analysis.complexityScore || 5,
            analysis.estimatedHours || 1,
            analysis.aiPercentage || 0,
            totalCost,
            'gpt-4o-mini',
            inputTokens,
            outputTokens,
            analysis.explanation || ''
        );
        
        return {
            hash,
            message,
            author,
            success: true
        };
        
    } catch (error) {
        console.error(`Error analyzing commit ${hash}:`, error.message);
        return {
            hash,
            success: false,
            error: error.message
        };
    }
}

async function syncMissingCommits() {
    console.log('🔍 Checking for missing commits...\n');
    
    const allCommitHashes = await getAllGitCommits();
    const existingHashes = await getExistingCommitHashes();
    
    const missingHashes = allCommitHashes.filter(hash => !existingHashes.has(hash));
    
    console.log(`📊 Total commits in repository: ${allCommitHashes.length}`);
    console.log(`✅ Already in database: ${existingHashes.size}`);
    console.log(`❗ Missing commits: ${missingHashes.length}\n`);
    
    if (missingHashes.length === 0) {
        console.log('All commits are already analyzed! 🎉');
        return;
    }
    
    console.log('Analyzing missing commits...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < missingHashes.length; i++) {
        const hash = missingHashes[i];
        console.log(`[${i + 1}/${missingHashes.length}] Analyzing ${hash.substring(0, 7)}...`);
        
        const result = await analyzeCommit(hash);
        
        if (result.success) {
            successCount++;
            console.log(`  ✅ ${result.message} (by ${result.author})`);
        } else {
            errorCount++;
            console.log(`  ❌ Failed: ${result.error}`);
        }
        
        // Add a small delay to avoid rate limiting
        if (i < missingHashes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Successfully analyzed: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    
    // Check new total
    const newTotal = db.prepare('SELECT COUNT(*) as count FROM commits').get();
    console.log(`  📁 Total commits in database: ${newTotal.count}`);
}

// Run the sync
syncMissingCommits().catch(console.error);