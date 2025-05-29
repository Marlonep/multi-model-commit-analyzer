// Fetch and display user statistics
async function loadUserStats() {
    try {
        const response = await fetch('/api/commits');
        const commits = await response.json();
        
        // Aggregate data by user
        const userStats = aggregateUserData(commits);
        
        // Display in table
        displayUserStats(userStats);
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// Aggregate commit data by user
function aggregateUserData(commits) {
    const userMap = new Map();
    
    commits.forEach(commit => {
        const user = commit.user || 'unknown';
        
        if (!userMap.has(user)) {
            userMap.set(user, {
                user: user,
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                lastCommit: null,
                totalQuality: 0,
                totalDevLevel: 0,
                totalComplexity: 0,
                totalHours: 0,
                totalAiPercentage: 0
            });
        }
        
        const stats = userMap.get(user);
        stats.commits++;
        stats.linesAdded += commit.linesAdded || 0;
        stats.linesDeleted += commit.linesDeleted || 0;
        
        // Update last commit timestamp
        if (!stats.lastCommit || new Date(commit.timestamp) > new Date(stats.lastCommit)) {
            stats.lastCommit = commit.timestamp;
        }
        
        // Accumulate averages
        stats.totalQuality += commit.averageCodeQuality || 0;
        stats.totalDevLevel += commit.averageDevLevel || 0;
        stats.totalComplexity += commit.averageComplexity || 0;
        stats.totalHours += commit.averageEstimatedHours || 0;
        stats.totalAiPercentage += commit.averageAiPercentage || 0;
    });
    
    // Calculate averages and convert to array
    const userStats = [];
    userMap.forEach(stats => {
        userStats.push({
            user: stats.user,
            commits: stats.commits,
            linesAdded: stats.linesAdded,
            linesDeleted: stats.linesDeleted,
            lastCommit: stats.lastCommit,
            avgQuality: stats.totalQuality / stats.commits,
            avgDevLevel: stats.totalDevLevel / stats.commits,
            avgComplexity: stats.totalComplexity / stats.commits,
            totalHours: stats.totalHours,
            avgAiPercentage: stats.totalAiPercentage / stats.commits
        });
    });
    
    // Sort by number of commits (descending)
    return userStats.sort((a, b) => b.commits - a.commits);
}

// Display user statistics in table
function displayUserStats(userStats) {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = '';
    
    userStats.forEach(user => {
        const row = document.createElement('tr');
        const lastCommitDate = new Date(user.lastCommit).toLocaleDateString();
        const devLevel = getDevLevel(user.avgDevLevel);
        
        row.innerHTML = `
            <td>${user.user}</td>
            <td>${user.commits}</td>
            <td>+${user.linesAdded.toLocaleString()}</td>
            <td>-${user.linesDeleted.toLocaleString()}</td>
            <td>${lastCommitDate}</td>
            <td>${user.avgQuality.toFixed(1)}/5</td>
            <td>${user.avgDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${user.avgComplexity.toFixed(1)}/5</td>
            <td>${user.totalHours.toFixed(1)}h</td>
            <td>${user.avgAiPercentage.toFixed(0)}%</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Helper function
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', loadUserStats);