#!/usr/bin/env node

/**
 * Extract Last Commit Data
 * 
 * This script queries the last commit from the repository and saves all its data
 * in a structured JSON format including metadata, diff, stats, and file changes.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function getLastCommitHash() {
    const { stdout } = await execAsync('git rev-parse HEAD');
    return stdout.trim();
}

async function getCommitMetadata(commitHash) {
    // Get basic commit information
    const { stdout: basicInfo } = await execAsync(
        `git show --format='%H|%h|%an|%ae|%at|%cn|%ce|%ct|%s|%b' --no-patch ${commitHash}`
    );
    
    const [hash, shortHash, authorName, authorEmail, authorDate, committerName, 
           committerEmail, committerDate, subject, ...bodyParts] = basicInfo.trim().split('|');
    
    // Get parent commits
    const { stdout: parents } = await execAsync(`git rev-parse ${commitHash}^@ 2>/dev/null || echo ""`);
    const parentCommits = parents.trim() ? parents.trim().split('\n') : [];
    
    // Get branch information
    const { stdout: branches } = await execAsync(`git branch -r --contains ${commitHash}`);
    const containingBranches = branches.trim().split('\n').map(b => b.trim());
    
    return {
        hash,
        shortHash,
        author: {
            name: authorName,
            email: authorEmail,
            date: new Date(parseInt(authorDate) * 1000).toISOString()
        },
        committer: {
            name: committerName,
            email: committerEmail,
            date: new Date(parseInt(committerDate) * 1000).toISOString()
        },
        message: {
            subject,
            body: bodyParts.join('|').trim()
        },
        parents: parentCommits,
        containingBranches
    };
}

async function getCommitStats(commitHash) {
    // Get commit statistics
    const { stdout: stats } = await execAsync(
        `git show --stat --format='' ${commitHash}`
    );
    
    // Parse the stats
    const lines = stats.trim().split('\n');
    const summaryLine = lines[lines.length - 1];
    const fileStats = lines.slice(0, -1);
    
    // Extract summary numbers
    const summaryMatch = summaryLine.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    
    return {
        filesChanged: summaryMatch ? parseInt(summaryMatch[1]) : 0,
        insertions: summaryMatch && summaryMatch[2] ? parseInt(summaryMatch[2]) : 0,
        deletions: summaryMatch && summaryMatch[3] ? parseInt(summaryMatch[3]) : 0,
        fileStats: fileStats.map(line => {
            const parts = line.trim().split('|');
            if (parts.length === 2) {
                const fileName = parts[0].trim();
                const changes = parts[1].trim();
                return { fileName, changes };
            }
            return null;
        }).filter(Boolean)
    };
}

async function getCommitDiff(commitHash) {
    // Get the full diff
    const { stdout: diff } = await execAsync(
        `git show --format='' ${commitHash}`
    );
    
    // Get file-by-file changes
    const { stdout: nameStatus } = await execAsync(
        `git show --name-status --format='' ${commitHash}`
    );
    
    const fileChanges = nameStatus.trim().split('\n').map(line => {
        const [status, ...filePathParts] = line.split('\t');
        const filePath = filePathParts.join('\t');
        return {
            status: status.trim(),
            filePath: filePath.trim(),
            statusDescription: getStatusDescription(status.trim())
        };
    });
    
    return {
        fullDiff: diff,
        fileChanges
    };
}

async function getFileSizes(commitHash) {
    // Get sizes of changed files
    const { stdout: files } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${commitHash}`
    );
    
    const fileSizes = [];
    for (const file of files.trim().split('\n').filter(Boolean)) {
        try {
            // Get file size in the commit
            const { stdout: sizeInCommit } = await execAsync(
                `git cat-file -s ${commitHash}:${file} 2>/dev/null || echo 0`
            );
            
            // Get file size in parent (if exists)
            const { stdout: sizeInParent } = await execAsync(
                `git cat-file -s ${commitHash}^:${file} 2>/dev/null || echo 0`
            );
            
            fileSizes.push({
                file,
                sizeInCommit: parseInt(sizeInCommit.trim()),
                sizeInParent: parseInt(sizeInParent.trim()),
                sizeDiff: parseInt(sizeInCommit.trim()) - parseInt(sizeInParent.trim())
            });
        } catch (error) {
            // File might not exist in one of the commits
            fileSizes.push({
                file,
                sizeInCommit: 0,
                sizeInParent: 0,
                sizeDiff: 0
            });
        }
    }
    
    return fileSizes;
}

async function getCodeAnalysis(commitHash) {
    // Analyze code changes by language/extension
    const { stdout: files } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${commitHash}`
    );
    
    const extensions = {};
    const languages = {
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.py': 'Python',
        '.java': 'Java',
        '.css': 'CSS',
        '.html': 'HTML',
        '.json': 'JSON',
        '.md': 'Markdown',
        '.yml': 'YAML',
        '.yaml': 'YAML'
    };
    
    files.trim().split('\n').filter(Boolean).forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (ext) {
            extensions[ext] = (extensions[ext] || 0) + 1;
        }
    });
    
    const languageStats = {};
    Object.entries(extensions).forEach(([ext, count]) => {
        const language = languages[ext] || 'Other';
        languageStats[language] = (languageStats[language] || 0) + count;
    });
    
    return {
        fileExtensions: extensions,
        languages: languageStats
    };
}

function getStatusDescription(status) {
    const statusDescriptions = {
        'A': 'Added',
        'M': 'Modified',
        'D': 'Deleted',
        'R': 'Renamed',
        'C': 'Copied',
        'T': 'Type changed',
        'U': 'Unmerged',
        'X': 'Unknown'
    };
    return statusDescriptions[status] || 'Unknown';
}

async function saveToJson(data, outputPath) {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(outputPath, jsonContent);
    console.log(`✅ Commit data saved to: ${outputPath}`);
}

async function main() {
    try {
        console.log('🔍 Extracting last commit data...\n');
        
        // Get the last commit hash
        const commitHash = await getLastCommitHash();
        console.log(`📌 Last commit: ${commitHash}`);
        
        // Collect all commit data
        console.log('📊 Gathering commit information...');
        
        const [metadata, stats, diff, fileSizes, codeAnalysis] = await Promise.all([
            getCommitMetadata(commitHash),
            getCommitStats(commitHash),
            getCommitDiff(commitHash),
            getFileSizes(commitHash),
            getCodeAnalysis(commitHash)
        ]);
        
        // Get repository information
        const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url');
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD');
        
        // Compile all data
        const commitData = {
            extractedAt: new Date().toISOString(),
            repository: {
                remoteUrl: remoteUrl.trim(),
                currentBranch: currentBranch.trim()
            },
            commit: {
                ...metadata,
                stats,
                diff,
                fileSizes,
                codeAnalysis
            }
        };
        
        // Save to JSON file
        const outputFileName = `commit_${commitHash.substring(0, 8)}_${Date.now()}.json`;
        const outputPath = path.join(process.cwd(), outputFileName);
        
        await saveToJson(commitData, outputPath);
        
        // Print summary
        console.log('\n📄 Commit Summary:');
        console.log(`   Author: ${metadata.author.name} <${metadata.author.email}>`);
        console.log(`   Date: ${metadata.author.date}`);
        console.log(`   Message: ${metadata.message.subject}`);
        console.log(`   Files Changed: ${stats.filesChanged}`);
        console.log(`   Insertions: ${stats.insertions}`);
        console.log(`   Deletions: ${stats.deletions}`);
        console.log(`   Languages: ${Object.keys(codeAnalysis.languages).join(', ')}`);
        
    } catch (error) {
        console.error('❌ Error extracting commit data:', error.message);
        process.exit(1);
    }
}

// Run the script
main();