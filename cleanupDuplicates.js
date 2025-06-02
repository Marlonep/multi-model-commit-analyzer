import fs from 'fs/promises';

async function cleanupDuplicates() {
    console.log('🧹 Cleaning up duplicate commits...\n');
    
    // Load the commit analysis history
    const data = await fs.readFile('commit_analysis_history.json', 'utf8');
    const commits = JSON.parse(data);
    
    console.log(`Total entries: ${commits.length}`);
    
    // Group commits by hash
    const commitsByHash = {};
    commits.forEach(commit => {
        if (!commitsByHash[commit.commitHash]) {
            commitsByHash[commit.commitHash] = [];
        }
        commitsByHash[commit.commitHash].push(commit);
    });
    
    // Find duplicates
    const duplicates = [];
    Object.entries(commitsByHash).forEach(([hash, commitList]) => {
        if (commitList.length > 1) {
            console.log(`\nDuplicate found for ${hash}:`);
            commitList.forEach((commit, index) => {
                console.log(`  ${index + 1}. Analyzed at: ${commit.timestamp}`);
            });
            
            // Keep the first one (oldest analysis), mark others for removal
            commitList.slice(1).forEach(commit => duplicates.push(commit));
        }
    });
    
    console.log(`\nFound ${duplicates.length} duplicate entries to remove`);
    
    // Remove duplicates
    const uniqueCommits = commits.filter(commit => 
        !duplicates.includes(commit)
    );
    
    console.log(`Unique commits: ${uniqueCommits.length}`);
    
    // Add analyzedAt field to track when the commit was pulled/analyzed
    const updatedCommits = uniqueCommits.map(commit => {
        // If there's no analyzedAt field, use the current timestamp field as analyzedAt
        // and keep the original commit date in timestamp
        if (!commit.analyzedAt) {
            return {
                ...commit,
                analyzedAt: commit.timestamp, // When it was analyzed
                // timestamp should remain as the original commit date
            };
        }
        return commit;
    });
    
    // Save the cleaned data
    await fs.writeFile(
        'commit_analysis_history.json', 
        JSON.stringify(updatedCommits, null, 2)
    );
    
    console.log('\n✅ Duplicates removed successfully!');
    console.log(`📊 Final count: ${updatedCommits.length} unique commits`);
}

cleanupDuplicates().catch(console.error);