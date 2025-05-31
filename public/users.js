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
            <td>
                <a href="/user-details.html?user=${encodeURIComponent(user.user)}" class="table-link">
                    ${user.user}
                </a>
            </td>
            <td>${user.commits}</td>
            <td>+${user.linesAdded.toLocaleString()}</td>
            <td>-${user.linesDeleted.toLocaleString()}</td>
            <td>${lastCommitDate}</td>
            <td>${user.avgQuality.toFixed(1)}/5</td>
            <td>${user.avgDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${user.avgComplexity.toFixed(1)}/5</td>
            <td>${user.totalHours.toFixed(1)}h</td>
            <td>${user.avgAiPercentage.toFixed(0)}%</td>
            <td>
                <div class="action-buttons">
                    <button class="view-details" onclick="viewUserDetails('${user.user}')">
                        Details
                    </button>
                    ${getGitHubProfileButton(user.user)}
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Helper functions
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

function viewUserDetails(userName) {
    window.location.href = `/user-details.html?user=${encodeURIComponent(userName)}`;
}

function getGitHubProfileButton(userName) {
    if (!userName) {
        return '<span style="color: var(--text-secondary)">-</span>';
    }
    
    // Map user names to GitHub usernames
    // In a real app, this would be stored in configuration or user profiles
    const githubUserMap = {
        'Marlon Espinosa': 'Marlonep',
        'marlonespinosaperez': 'Marlonep',
        // Add more mappings as needed
    };
    
    // Try to find a mapping, or use the name as-is (removing spaces)
    const githubUsername = githubUserMap[userName] || userName.replace(/\s+/g, '');
    const profileUrl = `https://github.com/${githubUsername}`;
    
    return `<a href="${profileUrl}" target="_blank" class="github-link">View Profile</a>`;
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadUserStats();
    setupSearchFunctionality();
});

// Search functionality
function setupSearchFunctionality() {
    const searchInput = document.getElementById('usersSearch');
    const tableBody = document.getElementById('usersBody');
    
    if (!searchInput || !tableBody) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = tableBody.getElementsByTagName('tr');
        
        Array.from(rows).forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}