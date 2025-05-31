// Get user name from URL
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('user');
let userCommits = [];
let githubConfig = null;

// Chart instances
let metricsChart = null;
let commitsPerDayChart = null;
let linesPerDayChart = null;

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

// Load user details
async function loadUserDetails() {
    if (!userName) {
        window.location.href = '/users.html';
        return;
    }

    try {
        // Load GitHub config first
        await loadGithubConfig();
        
        // Fetch all commits
        const response = await fetch('/api/commits');
        const allCommits = await response.json();
        
        // Filter commits for this user
        userCommits = allCommits.filter(commit => commit.user === userName);
        
        // Sort by date descending
        userCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayUserInfo();
        displayUserStats();
        displayCommitsTable();
        createCharts();
    } catch (error) {
        console.error('Error loading user details:', error);
        alert('Error loading user details');
        window.location.href = '/users.html';
    }
}

// Display user information
function displayUserInfo() {
    document.getElementById('userName').textContent = userName;
    document.getElementById('totalCommits').textContent = userCommits.length;
    
    const totalHours = userCommits.reduce((sum, commit) => sum + (commit.averageEstimatedHours || 0), 0);
    const totalHoursWithAI = userCommits.reduce((sum, commit) => sum + (commit.averageEstimatedHoursWithAi || 0), 0);
    const timeSaved = totalHours - totalHoursWithAI;
    
    document.getElementById('totalHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('timeSaved').textContent = timeSaved.toFixed(1) + 'h (' + 
        ((timeSaved / totalHours * 100) || 0).toFixed(0) + '%)';
}

// Display user statistics
function displayUserStats() {
    // Calculate averages
    const avgQuality = userCommits.reduce((sum, c) => sum + c.averageCodeQuality, 0) / userCommits.length;
    const avgDevLevel = userCommits.reduce((sum, c) => sum + c.averageDevLevel, 0) / userCommits.length;
    const avgComplexity = userCommits.reduce((sum, c) => sum + c.averageComplexity, 0) / userCommits.length;
    const avgAiPercent = userCommits.reduce((sum, c) => sum + (c.averageAiPercentage || 0), 0) / userCommits.length;
    
    // Calculate totals
    const totalLinesAdded = userCommits.reduce((sum, c) => sum + (c.linesAdded || 0), 0);
    const totalLinesDeleted = userCommits.reduce((sum, c) => sum + (c.linesDeleted || 0), 0);
    const totalLines = totalLinesAdded - totalLinesDeleted;
    const totalCost = userCommits.reduce((sum, c) => sum + (c.totalCost || 0), 0);
    
    // Update UI
    document.getElementById('avgQuality').textContent = avgQuality.toFixed(1);
    document.getElementById('avgDevLevel').textContent = avgDevLevel.toFixed(1) + ' (' + getDevLevel(avgDevLevel) + ')';
    document.getElementById('avgComplexity').textContent = avgComplexity.toFixed(1);
    document.getElementById('avgAiPercent').textContent = avgAiPercent.toFixed(0) + '%';
    document.getElementById('totalLines').textContent = totalLines.toLocaleString();
    document.getElementById('totalCost').textContent = '$' + totalCost.toFixed(2);
}

// Display commits table
function displayCommitsTable() {
    const tbody = document.getElementById('userCommitsBody');
    tbody.innerHTML = '';
    
    userCommits.forEach((commit, index) => {
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
                <a href="https://github.com/${githubConfig.username}/${githubConfig.repository}" 
                   target="_blank" class="table-link" title="View Repository">
                    ${commit.project}
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
    createMetricsChart();
    createCommitsPerDayChart();
    createLinesPerDayChart();
}

// Create performance metrics chart
function createMetricsChart() {
    const ctx = document.getElementById('metricsChart').getContext('2d');
    
    const avgQuality = userCommits.reduce((sum, c) => sum + c.averageCodeQuality, 0) / userCommits.length;
    const avgDevLevel = userCommits.reduce((sum, c) => sum + c.averageDevLevel, 0) / userCommits.length;
    const avgComplexity = userCommits.reduce((sum, c) => sum + c.averageComplexity, 0) / userCommits.length;
    
    metricsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Code Quality', 'Dev Level', 'Complexity'],
            datasets: [{
                label: 'Average Score',
                data: [avgQuality, avgDevLevel * 1.67, avgComplexity], // Scale dev level to 5
                backgroundColor: [
                    'rgba(57, 255, 20, 0.6)',
                    'rgba(255, 215, 0, 0.6)',
                    'rgba(0, 191, 255, 0.6)'
                ],
                borderColor: [
                    'rgba(57, 255, 20, 1)',
                    'rgba(255, 215, 0, 1)',
                    'rgba(0, 191, 255, 1)'
                ],
                borderWidth: 1
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

// Create commits per day chart
function createCommitsPerDayChart() {
    const ctx = document.getElementById('commitsPerDayChart').getContext('2d');
    
    // Group commits by date
    const commitsByDate = {};
    userCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        commitsByDate[date] = (commitsByDate[date] || 0) + 1;
    });
    
    // Sort dates and prepare data
    const dates = Object.keys(commitsByDate).sort((a, b) => new Date(a) - new Date(b));
    const counts = dates.map(date => commitsByDate[date]);
    
    commitsPerDayChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Commits',
                data: counts,
                backgroundColor: 'rgba(57, 255, 20, 0.6)',
                borderColor: 'rgba(57, 255, 20, 1)',
                borderWidth: 1
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

// Create lines per day chart
function createLinesPerDayChart() {
    const ctx = document.getElementById('linesPerDayChart').getContext('2d');
    
    // Group lines by date
    const linesByDate = {};
    userCommits.forEach(commit => {
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
    
    linesPerDayChart = new Chart(ctx, {
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

// Helper functions
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function viewCommitDetails(index) {
    // Get the global index in all commits
    fetch('/api/commits')
        .then(response => response.json())
        .then(allCommits => {
            const commit = userCommits[index];
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
            const rows = document.querySelectorAll('#userCommitsBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    setupSearch();
});