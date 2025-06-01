// Get project name from URL
const urlParams = new URLSearchParams(window.location.search);
const projectName = urlParams.get('project');
let projectCommits = [];
let githubConfig = null;

// Chart instances
let activityChart = null;
let contributorsChart = null;
let codeChangesChart = null;
let qualityTrendsChart = null;
let contributorsByDayChart = null;
let dailyLinesChart = null;

// Fetch GitHub configuration
async function loadGithubConfig() {
    try {
        const response = await fetch('/api/github-config');
        githubConfig = await response.json();
    } catch (error) {
        console.error('Error loading GitHub config:', error);
        githubConfig = {
            username: 'Marlonep',
            repository: 'multi-model-commit-analyzer',
            baseUrl: 'https://github.com/Marlonep/multi-model-commit-analyzer'
        };
    }
}

// Load project details
async function loadProjectDetails() {
    if (!projectName) {
        window.location.href = '/projects.html';
        return;
    }

    try {
        // Load GitHub config first
        await loadGithubConfig();
        
        // Fetch all commits
        const response = await fetch('/api/commits');
        const allCommits = await response.json();
        
        // Filter commits for this project
        projectCommits = allCommits.filter(commit => commit.project === projectName);
        
        // Sort by date descending
        projectCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayProjectInfo();
        displayProjectStats();
        displayContributorsTable();
        displayCommitsTable();
        createCharts();
    } catch (error) {
        console.error('Error loading project details:', error);
        alert('Error loading project details');
        window.location.href = '/projects.html';
    }
}

// Display project information
function displayProjectInfo() {
    document.getElementById('projectName').textContent = projectName;
    document.getElementById('projectNameLink').href = 
        `https://github.com/${githubConfig.username}/${githubConfig.repository}`;
    
    document.getElementById('totalCommits').textContent = projectCommits.length;
    
    // Count unique contributors
    const contributors = new Set(projectCommits.map(c => c.user));
    document.getElementById('totalContributors').textContent = contributors.size;
    
    // Count active days
    const activeDates = new Set(projectCommits.map(c => 
        new Date(c.timestamp).toLocaleDateString()
    ));
    document.getElementById('activeDays').textContent = activeDates.size;
}

// Display project statistics
function displayProjectStats() {
    if (projectCommits.length === 0) return;
    
    // Calculate averages
    const avgQuality = projectCommits.reduce((sum, c) => sum + c.averageCodeQuality, 0) / projectCommits.length;
    const avgDevLevel = projectCommits.reduce((sum, c) => sum + c.averageDevLevel, 0) / projectCommits.length;
    const avgComplexity = projectCommits.reduce((sum, c) => sum + c.averageComplexity, 0) / projectCommits.length;
    const avgAiPercent = projectCommits.reduce((sum, c) => sum + (c.averageAiPercentage || 0), 0) / projectCommits.length;
    
    // Calculate totals
    const totalHours = projectCommits.reduce((sum, c) => sum + (c.averageEstimatedHours || 0), 0);
    const totalCost = projectCommits.reduce((sum, c) => sum + (c.totalCost || 0), 0);
    
    // Update UI
    document.getElementById('avgQuality').textContent = avgQuality.toFixed(1);
    document.getElementById('avgDevLevel').textContent = avgDevLevel.toFixed(1) + ' (' + getDevLevel(avgDevLevel) + ')';
    document.getElementById('avgComplexity').textContent = avgComplexity.toFixed(1);
    document.getElementById('avgAiPercent').textContent = avgAiPercent.toFixed(0) + '%';
    document.getElementById('totalHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('totalCost').textContent = '$' + totalCost.toFixed(2);
}

// Display contributors table
function displayContributorsTable() {
    const tbody = document.getElementById('contributorsBody');
    tbody.innerHTML = '';
    
    // Calculate stats per contributor
    const contributorStats = {};
    projectCommits.forEach(commit => {
        const user = commit.user;
        if (!contributorStats[user]) {
            contributorStats[user] = {
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                totalQuality: 0,
                totalComplexity: 0,
                totalHours: 0
            };
        }
        contributorStats[user].commits++;
        contributorStats[user].linesAdded += commit.linesAdded || 0;
        contributorStats[user].linesDeleted += commit.linesDeleted || 0;
        contributorStats[user].totalQuality += commit.averageCodeQuality || 0;
        contributorStats[user].totalComplexity += commit.averageComplexity || 0;
        contributorStats[user].totalHours += commit.averageEstimatedHours || 0;
    });
    
    // Convert to array and sort by commits
    const contributors = Object.entries(contributorStats)
        .map(([user, stats]) => ({
            user,
            ...stats,
            avgQuality: stats.totalQuality / stats.commits,
            avgComplexity: stats.totalComplexity / stats.commits
        }))
        .sort((a, b) => b.commits - a.commits);
    
    // Display contributors
    contributors.forEach(contributor => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <a href="/user-details.html?user=${encodeURIComponent(contributor.user)}" 
                   class="table-link" title="View User Details">
                    ${contributor.user}
                </a>
            </td>
            <td>${contributor.commits}</td>
            <td>+${contributor.linesAdded.toLocaleString()}</td>
            <td>-${contributor.linesDeleted.toLocaleString()}</td>
            <td>${contributor.avgQuality.toFixed(1)}</td>
            <td>${contributor.avgComplexity.toFixed(1)}</td>
            <td>${contributor.totalHours.toFixed(1)}h</td>
            <td>
                <button class="view-details" onclick="viewUserDetails('${contributor.user}')">
                    Details
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Display commits table
function displayCommitsTable() {
    const tbody = document.getElementById('projectCommitsBody');
    tbody.innerHTML = '';
    
    projectCommits.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleString();
        
        row.innerHTML = `
            <td>${date}</td>
            <td>
                <a href="https://github.com/${githubConfig.username}/${githubConfig.repository}/commit/${commit.commitHash}" 
                   target="_blank" class="table-link" title="View on GitHub">
                    ${commit.commitHash.substring(0, 8)}
                </a>
            </td>
            <td>
                <a href="/user-details.html?user=${encodeURIComponent(commit.user)}" 
                   class="table-link" title="View User Details">
                    ${commit.user}
                </a>
            </td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 40)}</td>
            <td>${commit.fileChanges || 0}</td>
            <td>+${commit.linesAdded || 0}</td>
            <td>-${commit.linesDeleted || 0}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>
                <button class="view-details" onclick="viewCommitDetails(${index})">
                    Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Create charts
function createCharts() {
    createActivityChart();
    createContributorsChart();
    createCodeChangesChart();
    createQualityTrendsChart();
    createContributorsByDayChart();
    createDailyLinesChart();
}

// Create activity timeline chart
function createActivityChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    // Group commits by date
    const commitsByDate = {};
    projectCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        commitsByDate[date] = (commitsByDate[date] || 0) + 1;
    });
    
    // Sort dates and prepare data
    const dates = Object.keys(commitsByDate).sort((a, b) => new Date(a) - new Date(b));
    const counts = dates.map(date => commitsByDate[date]);
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Commits',
                data: counts,
                borderColor: 'rgba(57, 255, 20, 1)',
                backgroundColor: 'rgba(57, 255, 20, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Create contributors chart
function createContributorsChart() {
    const ctx = document.getElementById('contributorsChart').getContext('2d');
    
    // Count commits per contributor
    const commitsByUser = {};
    projectCommits.forEach(commit => {
        commitsByUser[commit.user] = (commitsByUser[commit.user] || 0) + 1;
    });
    
    // Sort by commits and take top 5
    const sortedContributors = Object.entries(commitsByUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const users = sortedContributors.map(([user]) => user);
    const commits = sortedContributors.map(([, count]) => count);
    
    contributorsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: users,
            datasets: [{
                data: commits,
                backgroundColor: [
                    'rgba(57, 255, 20, 0.8)',
                    'rgba(255, 215, 0, 0.8)',
                    'rgba(0, 191, 255, 0.8)',
                    'rgba(255, 69, 0, 0.8)',
                    'rgba(147, 112, 219, 0.8)'
                ],
                borderColor: [
                    'rgba(57, 255, 20, 1)',
                    'rgba(255, 215, 0, 1)',
                    'rgba(0, 191, 255, 1)',
                    'rgba(255, 69, 0, 1)',
                    'rgba(147, 112, 219, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#c9d1d9',
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 10
                }
            }
        }
    });
}

// Create code changes chart
function createCodeChangesChart() {
    const ctx = document.getElementById('codeChangesChart').getContext('2d');
    
    // Sort commits by date
    const sortedCommits = [...projectCommits].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // Calculate cumulative lines
    let cumulativeLines = 0;
    const dates = [];
    const cumulativeData = [];
    
    sortedCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        cumulativeLines += (commit.linesAdded || 0) - (commit.linesDeleted || 0);
        dates.push(date);
        cumulativeData.push(cumulativeLines);
    });
    
    codeChangesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Cumulative Lines of Code',
                data: cumulativeData,
                borderColor: 'rgba(0, 191, 255, 1)',
                backgroundColor: 'rgba(0, 191, 255, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9',
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Create quality trends chart
function createQualityTrendsChart() {
    const ctx = document.getElementById('qualityTrendsChart').getContext('2d');
    
    // Sort commits by date
    const sortedCommits = [...projectCommits].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    const dates = sortedCommits.map(c => new Date(c.timestamp).toLocaleDateString());
    const quality = sortedCommits.map(c => c.averageCodeQuality);
    const complexity = sortedCommits.map(c => c.averageComplexity);
    
    qualityTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Code Quality',
                data: quality,
                borderColor: 'rgba(57, 255, 20, 1)',
                backgroundColor: 'rgba(57, 255, 20, 0.1)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Complexity',
                data: complexity,
                borderColor: 'rgba(255, 69, 0, 1)',
                backgroundColor: 'rgba(255, 69, 0, 0.1)',
                tension: 0.1,
                yAxisID: 'y'
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#c9d1d9'
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 0,
                    max: 5,
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9',
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Create contributors by day stacked bar chart
function createContributorsByDayChart() {
    const ctx = document.getElementById('contributorsByDayChart').getContext('2d');
    
    // Group commits by date and contributor
    const commitsByDateAndUser = {};
    const allUsers = new Set();
    
    projectCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        const user = commit.user;
        
        if (!commitsByDateAndUser[date]) {
            commitsByDateAndUser[date] = {};
        }
        
        commitsByDateAndUser[date][user] = (commitsByDateAndUser[date][user] || 0) + 1;
        allUsers.add(user);
    });
    
    // Sort dates
    const dates = Object.keys(commitsByDateAndUser).sort((a, b) => new Date(a) - new Date(b));
    const users = Array.from(allUsers).sort();
    
    // Generate colors for each user
    const colors = [
        'rgba(57, 255, 20, 0.8)',
        'rgba(255, 215, 0, 0.8)',
        'rgba(0, 191, 255, 0.8)',
        'rgba(255, 69, 0, 0.8)',
        'rgba(147, 112, 219, 0.8)',
        'rgba(255, 182, 193, 0.8)',
        'rgba(64, 224, 208, 0.8)',
        'rgba(255, 140, 0, 0.8)',
        'rgba(50, 205, 50, 0.8)',
        'rgba(255, 105, 180, 0.8)'
    ];
    
    // Create datasets for each user
    const datasets = users.map((user, index) => {
        const data = dates.map(date => commitsByDateAndUser[date][user] || 0);
        return {
            label: user,
            data: data,
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.8', '1'),
            borderWidth: 1
        };
    });
    
    contributorsByDayChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#c9d1d9',
                        maxTicksLimit: 15
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#c9d1d9'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        afterTitle: function(context) {
                            let total = 0;
                            context.forEach(tooltipItem => {
                                total += tooltipItem.parsed.y;
                            });
                            return 'Total: ' + total + ' commits';
                        }
                    }
                }
            }
        }
    });
}

// Create daily lines added/deleted chart
function createDailyLinesChart() {
    const ctx = document.getElementById('dailyLinesChart').getContext('2d');
    
    // Group lines by date
    const linesByDate = {};
    projectCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        if (!linesByDate[date]) {
            linesByDate[date] = { added: 0, deleted: 0 };
        }
        linesByDate[date].added += commit.linesAdded || 0;
        linesByDate[date].deleted += commit.linesDeleted || 0;
    });
    
    // Sort dates and prepare data
    const dates = Object.keys(linesByDate).sort((a, b) => new Date(a) - new Date(b));
    const linesAdded = dates.map(date => linesByDate[date].added);
    const linesDeleted = dates.map(date => -linesByDate[date].deleted); // Negative for visual effect
    
    dailyLinesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Lines Added',
                data: linesAdded,
                backgroundColor: 'rgba(57, 255, 20, 0.6)',
                borderColor: 'rgba(57, 255, 20, 1)',
                borderWidth: 1
            }, {
                label: 'Lines Deleted',
                data: linesDeleted,
                backgroundColor: 'rgba(255, 69, 0, 0.6)',
                borderColor: 'rgba(255, 69, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#c9d1d9'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = Math.abs(context.parsed.y);
                            label += value;
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#c9d1d9',
                        callback: function(value) {
                            return Math.abs(value);
                        }
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9',
                        maxTicksLimit: 15
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Helper functions
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function viewUserDetails(userName) {
    window.location.href = `/user-details.html?user=${encodeURIComponent(userName)}`;
}

function viewCommitDetails(index) {
    // Get the global index in all commits
    fetch('/api/commits')
        .then(response => response.json())
        .then(allCommits => {
            const commit = projectCommits[index];
            const globalIndex = allCommits.findIndex(c => c.commitHash === commit.commitHash);
            window.location.href = `/details.html?index=${globalIndex}`;
        });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('commitsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#projectCommitsBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadProjectDetails();
    setupSearch();
});