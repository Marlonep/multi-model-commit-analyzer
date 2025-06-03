import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Generate daily report for a specific date or yesterday
async function generateDailyReport(targetDate = null) {
    try {
        // Determine the date to process
        const dateToProcess = targetDate || getYesterdayMexicoCity();
        console.log(`Generating daily report for: ${dateToProcess}`);
        
        // Read commit analysis history
        const historyPath = path.join(__dirname, 'commit_analysis_history.json');
        const historyData = await fs.readFile(historyPath, 'utf8');
        const commitHistory = JSON.parse(historyData);
        
        // Sort commit history by timestamp descending (latest first) to match frontend
        const sortedCommitHistory = [...commitHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Read existing daily commits if any
        const dailyCommitsPath = path.join(__dirname, 'daily-commits.json');
        let existingDailyCommits = { dailyCommits: [] };
        
        try {
            const existingData = await fs.readFile(dailyCommitsPath, 'utf8');
            existingDailyCommits = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist yet, that's okay
            console.log('No existing daily-commits.json found, creating new one');
        }
        
        // Group commits by date and user
        const commitsByDateAndUser = {};
        
        for (const commit of commitHistory) {
            // Extract date from commit timestamp
            const commitDate = formatDate(new Date(commit.timestamp));
            
            // Skip if not the target date (when processing specific date)
            if (targetDate && commitDate !== targetDate) continue;
            
            const user = commit.user;
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
            commitsByDateAndUser[key].projects.add(commit.project);
        }
        
        // Generate daily summaries
        const newDailySummaries = [];
        
        for (const key in commitsByDateAndUser) {
            const data = commitsByDateAndUser[key];
            const commits = data.commits;
            
            // Calculate averages from modelScores
            let totalCodeQuality = 0;
            let totalComplexity = 0;
            let totalDevLevel = 0;
            let totalHours = 0;
            let totalScoreCount = 0;
            
            for (const commit of commits) {
                if (commit.modelScores && commit.modelScores.length > 0) {
                    // Calculate average across all models for this commit
                    const commitCodeQuality = calculateAverage(commit.modelScores.map(m => m.codeQuality || 0));
                    const commitComplexity = calculateAverage(commit.modelScores.map(m => m.complexity || 0));
                    const commitDevLevel = calculateAverage(commit.modelScores.map(m => m.devLevel || 0));
                    const commitHours = calculateAverage(commit.modelScores.map(m => m.estimatedHours || 0));
                    
                    totalCodeQuality += commitCodeQuality;
                    totalComplexity += commitComplexity;
                    totalDevLevel += commitDevLevel;
                    totalHours += commitHours;
                    totalScoreCount++;
                }
            }
            
            // Calculate final averages
            const avgCodeQuality = totalScoreCount > 0 ? totalCodeQuality / totalScoreCount : 0;
            const avgComplexity = totalScoreCount > 0 ? totalComplexity / totalScoreCount : 0;
            const avgDevLevel = totalScoreCount > 0 ? totalDevLevel / totalScoreCount : 0;
            
            const summary = {
                date: data.date,
                user: data.user,
                avgCodeQuality: avgCodeQuality,
                avgComplexity: avgComplexity,
                avgDevLevel: avgDevLevel,
                totalHours: totalHours,
                commitCount: commits.length,
                projects: Array.from(data.projects).sort(),
                commitHashes: commits.map(c => c.commitHash),
                commitIndices: commits.map(c => {
                    // Find the index of this commit in the sorted complete history
                    return sortedCommitHistory.findIndex(historyCommit => historyCommit.commitHash === c.commitHash);
                }).filter(index => index !== -1)
            };
            
            newDailySummaries.push(summary);
        }
        
        // If processing all dates, merge with existing data
        if (!targetDate) {
            // Create a map of existing summaries for easy lookup
            const existingMap = new Map();
            existingDailyCommits.dailyCommits.forEach(dc => {
                existingMap.set(`${dc.date}|${dc.user}`, dc);
            });
            
            // Add or update summaries
            newDailySummaries.forEach(summary => {
                const key = `${summary.date}|${summary.user}`;
                existingMap.set(key, summary);
            });
            
            // Convert back to array and sort
            existingDailyCommits.dailyCommits = Array.from(existingMap.values())
                .sort((a, b) => {
                    const dateCompare = b.date.localeCompare(a.date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.user.localeCompare(b.user);
                });
        } else {
            // If processing specific date, just update that date's entries
            const filteredExisting = existingDailyCommits.dailyCommits.filter(
                dc => dc.date !== targetDate
            );
            
            existingDailyCommits.dailyCommits = [...filteredExisting, ...newDailySummaries]
                .sort((a, b) => {
                    const dateCompare = b.date.localeCompare(a.date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.user.localeCompare(b.user);
                });
        }
        
        // Add users with no commits for the date
        if (targetDate) {
            // Get all unique users from commit history
            try {
                const allCommitUsers = [...new Set(commitHistory.map(c => c.user))];
                console.log('Found users in commit history:', allCommitUsers);
                
                // Check which users don't have commits for this date
                const usersWithCommits = new Set(
                    existingDailyCommits.dailyCommits
                        .filter(dc => dc.date === targetDate)
                        .map(dc => dc.user)
                );
                
                // Add entries for users with no activity
                for (const user of allCommitUsers) {
                    if (!usersWithCommits.has(user)) {
                        existingDailyCommits.dailyCommits.push({
                            date: targetDate,
                            user: user,
                            avgCodeQuality: 0,
                            avgComplexity: 0,
                            avgDevLevel: 0,
                            totalHours: 0,
                            commitCount: 0,
                            projects: [],
                            commitHashes: [],
                            commitIndices: []
                        });
                    }
                }
                
                // Re-sort after adding no-activity entries
                existingDailyCommits.dailyCommits.sort((a, b) => {
                    const dateCompare = b.date.localeCompare(a.date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.user.localeCompare(b.user);
                });
            } catch (error) {
                console.log('Could not extract users from commit history, skipping no-activity entries');
            }
        }
        
        // Save the updated daily commits
        await fs.writeFile(
            dailyCommitsPath,
            JSON.stringify(existingDailyCommits, null, 2)
        );
        
        const daysProcessed = new Set(newDailySummaries.map(s => s.date)).size;
        console.log(`Daily report generated successfully. Processed ${daysProcessed} days.`);
        
        return {
            success: true,
            daysProcessed: daysProcessed,
            summariesGenerated: newDailySummaries.length
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
            console.log('Report generation completed successfully');
            process.exit(0);
        } else {
            console.error('Report generation failed:', result.error);
            process.exit(1);
        }
    });
}

export { generateDailyReport, getYesterdayMexicoCity };