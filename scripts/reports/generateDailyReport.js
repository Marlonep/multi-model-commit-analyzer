import { dbHelpers } from './database.js';

// Mexico City timezone offset (UTC-6 or UTC-5 during DST)
const MEXICO_CITY_OFFSET = -6; // Adjust based on DST if needed

// Get date in Mexico City timezone
function getMexicoCityDate(date = new Date()) {
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return new Date(utcDate.getTime() + MEXICO_CITY_OFFSET * 3600000);
}

// Format date as YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get yesterday's date in Mexico City timezone
function getYesterdayMexicoCity() {
    const today = getMexicoCityDate();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
}

// Calculate average of an array
function calculateAverage(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

// Extract date from timestamp
function extractDate(timestamp) {
    return formatDate(new Date(timestamp));
}

// Generate daily report for a specific date or yesterday
async function generateDailyReport(targetDate = null) {
    try {
        // Determine the date to process
        const dateToProcess = targetDate || getYesterdayMexicoCity();
        console.log(`Generating daily report for: ${dateToProcess}`);
        
        // Get all commits from the database
        const allCommits = dbHelpers.getAllCommits('admin', null, null);
        console.log(`Found ${allCommits.length} total commits in database`);
        
        // Filter commits for the target date if specified, otherwise process all dates
        let commitsToProcess = allCommits;
        if (targetDate) {
            commitsToProcess = allCommits.filter(commit => {
                const commitDate = extractDate(commit.timestamp);
                return commitDate === targetDate;
            });
            console.log(`Found ${commitsToProcess.length} commits for date ${targetDate}`);
        }
        
        // Group commits by date and user
        const commitsByDateAndUser = {};
        
        commitsToProcess.forEach(commit => {
            const commitDate = extractDate(commit.timestamp);
            const user = commit.user_name;
            const key = `${commitDate}|${user}`;
            
            if (!commitsByDateAndUser[key]) {
                commitsByDateAndUser[key] = {
                    date: commitDate,
                    user: user,
                    commits: [],
                    projects: new Set()
                };
            }
            
            commitsByDateAndUser[key].commits.push(commit);
            if (commit.project) {
                commitsByDateAndUser[key].projects.add(commit.project);
            }
        });
        
        console.log(`Processing ${Object.keys(commitsByDateAndUser).length} date-user combinations`);
        
        // Generate daily summaries and save to database
        let savedCount = 0;
        let processedDates = new Set();
        
        for (const key in commitsByDateAndUser) {
            const data = commitsByDateAndUser[key];
            const commits = data.commits;
            
            // Parse model scores and calculate aggregated values
            let totalCodeQuality = 0;
            let totalComplexity = 0;
            let totalDevLevel = 0;
            let totalHours = 0;
            let totalCommitsWithScores = 0;
            
            commits.forEach(commit => {
                // Use database averages first, then try to parse model scores
                if (commit.average_code_quality && commit.average_complexity && commit.average_dev_level && commit.average_estimated_hours) {
                    totalCodeQuality += commit.average_code_quality;
                    totalComplexity += commit.average_complexity;
                    totalDevLevel += commit.average_dev_level;
                    totalHours += commit.average_estimated_hours;
                    totalCommitsWithScores++;
                } else {
                    // Fallback: try to parse model scores from stored data
                    let modelScores = [];
                    try {
                        if (commit.model_scores) {
                            modelScores = JSON.parse(commit.model_scores);
                        } else if (commit.analysis_details) {
                            const analysisDetails = JSON.parse(commit.analysis_details);
                            if (analysisDetails.originalData?.modelScores) {
                                modelScores = analysisDetails.originalData.modelScores;
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to parse model scores for commit ${commit.commit_hash}:`, error.message);
                    }
                    
                    if (modelScores && modelScores.length > 0) {
                        const avgCodeQuality = calculateAverage(modelScores.map(m => m.codeQuality || 0));
                        const avgComplexity = calculateAverage(modelScores.map(m => m.complexity || 0));
                        const avgDevLevel = calculateAverage(modelScores.map(m => m.devLevel || 0));
                        const avgHours = calculateAverage(modelScores.map(m => m.estimatedHours || 0));
                        
                        totalCodeQuality += avgCodeQuality;
                        totalComplexity += avgComplexity;
                        totalDevLevel += avgDevLevel;
                        totalHours += avgHours;
                        totalCommitsWithScores++;
                    }
                }
            });
            
            // Calculate final averages
            const avgCodeQuality = totalCommitsWithScores > 0 ? totalCodeQuality / totalCommitsWithScores : 0;
            const avgComplexity = totalCommitsWithScores > 0 ? totalComplexity / totalCommitsWithScores : 0;
            const avgDevLevel = totalCommitsWithScores > 0 ? totalDevLevel / totalCommitsWithScores : 0;
            
            // Calculate total lines added and deleted
            const totalLinesAdded = commits.reduce((sum, c) => sum + (c.lines_added || 0), 0);
            const totalLinesDeleted = commits.reduce((sum, c) => sum + (c.lines_deleted || 0), 0);
            
            // Create arrays for commit hashes and calculate indices
            const commitHashes = commits.map(c => c.commit_hash);
            const commitIndices = commits.map(c => {
                // Find the index of this commit in the complete sorted history
                return allCommits.findIndex(historyCommit => historyCommit.commit_hash === c.commit_hash);
            }).filter(index => index !== -1);
            
            // Create summary description
            const projects = Array.from(data.projects).sort();
            const summaryText = `${commits.length} commits, ${totalLinesAdded} lines added, ${totalLinesDeleted} lines deleted. Projects: ${projects.join(', ')}`;
            
            try {
                // Save to database (with fallback for missing columns)
                const dailyCommitData = {
                    date: data.date,
                    user_name: data.user,
                    total_commits: commits.length,
                    total_lines_added: totalLinesAdded,
                    total_lines_deleted: totalLinesDeleted,
                    total_hours: totalHours,
                    average_quality: avgCodeQuality,
                    average_complexity: avgComplexity,
                    summary: summaryText
                };
                
                // Only add these fields if the columns exist
                try {
                    dailyCommitData.average_dev_level = avgDevLevel;
                    dailyCommitData.projects = projects;
                    dailyCommitData.commit_hashes = commitHashes;
                    dailyCommitData.commit_indices = commitIndices;
                } catch (error) {
                    console.warn('Some daily_commits columns may be missing, using basic data only');
                }
                
                dbHelpers.createOrUpdateDailyCommit(dailyCommitData);
                
                savedCount++;
                processedDates.add(data.date);
                console.log(`✓ Saved daily summary for ${data.user} on ${data.date}: ${commits.length} commits, ${totalHours.toFixed(2)} hours`);
                
            } catch (error) {
                console.error(`Error saving daily commit for ${data.user} on ${data.date}:`, error.message);
            }
        }
        
        // Add users with no commits for the specific target date
        if (targetDate) {
            try {
                const allUsers = [...new Set(allCommits.map(c => c.user_name))];
                const usersWithCommits = new Set(Object.values(commitsByDateAndUser).map(d => d.user));
                
                for (const user of allUsers) {
                    if (!usersWithCommits.has(user)) {
                        try {
                            dbHelpers.createOrUpdateDailyCommit({
                                date: targetDate,
                                user_name: user,
                                total_commits: 0,
                                total_lines_added: 0,
                                total_lines_deleted: 0,
                                total_hours: 0,
                                average_quality: 0,
                                average_complexity: 0,
                                average_dev_level: 0,
                                projects: [],
                                commit_hashes: [],
                                commit_indices: [],
                                summary: 'No commits on this date'
                            });
                            savedCount++;
                            console.log(`✓ Added no-activity entry for ${user} on ${targetDate}`);
                        } catch (error) {
                            console.error(`Error saving no-activity entry for ${user}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.error('Error adding no-activity entries:', error.message);
            }
        }
        
        const daysProcessed = processedDates.size;
        console.log(`\n✅ Daily report generation completed:`);
        console.log(`   - Days processed: ${daysProcessed}`);
        console.log(`   - Records saved: ${savedCount}`);
        console.log(`   - Total commits analyzed: ${commitsToProcess.length}`);
        
        return {
            success: true,
            daysProcessed: daysProcessed,
            summariesGenerated: savedCount,
            recordsSaved: savedCount,
            commitsAnalyzed: commitsToProcess.length
        };
        
    } catch (error) {
        console.error('Error generating daily report:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the report generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Check if a specific date was provided as command line argument
    const args = process.argv.slice(2);
    const targetDate = args[0] || null;
    
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error('Invalid date format. Please use YYYY-MM-DD format.');
        process.exit(1);
    }
    
    generateDailyReport(targetDate).then(result => {
        if (result.success) {
            console.log('\n🎉 Report generation completed successfully');
            process.exit(0);
        } else {
            console.error('\n❌ Report generation failed:', result.error);
            process.exit(1);
        }
    });
}

export { generateDailyReport, getYesterdayMexicoCity };