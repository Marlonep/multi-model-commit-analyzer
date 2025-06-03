#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Script to add organization field to all existing commits in commit_analysis_history.json
 */

const COMMIT_HISTORY_FILE = './commit_analysis_history.json';
const ORGANIZATION_NAME = 'Nuclea-Solutions';

async function addOrganizationToCommits() {
    try {
        console.log('🔄 Adding organization field to existing commits...');
        
        // Read existing commit history
        if (!fs.existsSync(COMMIT_HISTORY_FILE)) {
            console.error('❌ commit_analysis_history.json not found');
            process.exit(1);
        }
        
        const data = fs.readFileSync(COMMIT_HISTORY_FILE, 'utf8');
        const commits = JSON.parse(data);
        
        console.log(`📊 Found ${commits.length} commits to update`);
        
        // Add organization field to each commit if it doesn't exist
        let updatedCount = 0;
        commits.forEach(commit => {
            if (!commit.organization) {
                commit.organization = ORGANIZATION_NAME;
                updatedCount++;
            }
        });
        
        // Write back to file
        fs.writeFileSync(COMMIT_HISTORY_FILE, JSON.stringify(commits, null, 2));
        
        console.log(`✅ Successfully added organization field to ${updatedCount} commits`);
        console.log(`🏢 Organization set to: ${ORGANIZATION_NAME}`);
        
    } catch (error) {
        console.error('❌ Error updating commits:', error);
        process.exit(1);
    }
}

// Run the script
addOrganizationToCommits();