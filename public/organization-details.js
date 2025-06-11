// Get organization name from URL
const urlParams = new URLSearchParams(window.location.search);
const organizationName = urlParams.get('org');
let organizationCommits = [];

// Chart instances
let metricsChart = null;
let projectsChart = null;

// Helper function to get dev level string
function getDevLevel(level) {
    if (level >= 9) return 'Exp';
    if (level >= 7) return 'Sr';
    if (level >= 5) return 'Mid';
    if (level >= 3) return 'Jr';
    return 'Beg';
}

// Load organization details
async function loadOrganizationDetails() {
    if (!organizationName) {
        window.location.href = '/organizations.html';
        return;
    }

    try {
        // First, fetch organization data using the slug
        const orgResponse = await fetch(`/api/organizations/${organizationName}`, {
            headers: getAuthHeaders()
        });
        
        if (!orgResponse.ok) {
            throw new Error('Organization not found');
        }
        
        const organizationData = await orgResponse.json();
        
        // Fetch all commits
        const response = await fetch('/api/commits', {
            headers: getAuthHeaders()
        });
        const allCommits = await response.json();
        
        // Filter commits for this organization using the actual organization name
        organizationCommits = allCommits.filter(commit => 
            (commit.organization || 'Unknown') === organizationData.name
        );
        
        // Sort by date descending
        organizationCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Store organization data for display
        window.organizationData = organizationData;
        
        displayOrganizationInfo();
        displayOrganizationStats();
        displayPeopleSection();
        displayProjectsTable();
        displayCommitsTable();
        createCharts();
    } catch (error) {
        console.error('Error loading organization details:', error);
        alert('Error loading organization details');
        window.location.href = '/organizations.html';
    }
}

// Display organization information
function displayOrganizationInfo() {
    const org = window.organizationData;
    
    // Display organization name and details
    document.getElementById('organizationName').textContent = org.display_name || org.name;
    
    // Set GitHub organization link
    if (org.github_url) {
        document.getElementById('githubOrgLink').href = org.github_url;
    } else if (organizationName !== 'Unknown') {
        document.getElementById('githubOrgLink').href = `https://github.com/${org.name}`;
    } else {
        document.getElementById('githubOrgLink').style.display = 'none';
    }
    
    // Display stats from API response if available
    if (org.stats) {
        document.getElementById('totalProjects').textContent = org.stats.totalProjects || new Set(organizationCommits.map(c => c.project)).size;
        document.getElementById('totalContributors').textContent = org.stats.totalMembers || new Set(organizationCommits.map(c => c.user)).size;
        document.getElementById('totalCommits').textContent = org.stats.totalCommits || organizationCommits.length;
    } else {
        // Count unique projects
        const projects = new Set(organizationCommits.map(c => c.project));
        document.getElementById('totalProjects').textContent = projects.size;
        
        // Count unique contributors
        const contributors = new Set(organizationCommits.map(c => c.user));
        document.getElementById('totalContributors').textContent = contributors.size;
        
        document.getElementById('totalCommits').textContent = organizationCommits.length;
    }
    
    // Find earliest commit date
    if (organizationCommits.length > 0) {
        const earliestDate = new Date(Math.min(...organizationCommits.map(c => new Date(c.timestamp))));
        document.getElementById('activeSince').textContent = earliestDate.toLocaleDateString();
    }
    
    // Display additional organization info if available
    if (org.description) {
        const descElement = document.getElementById('orgDescription');
        if (descElement) {
            descElement.textContent = org.description;
            descElement.style.display = 'block';
        }
    }
    
    if (org.website) {
        const websiteElement = document.getElementById('orgWebsite');
        if (websiteElement) {
            websiteElement.href = org.website;
            websiteElement.textContent = org.website;
            websiteElement.style.display = 'inline';
        }
    }
}

// Display organization statistics
function displayOrganizationStats() {
    if (organizationCommits.length === 0) return;
    
    // Calculate averages
    const avgQuality = organizationCommits.reduce((sum, c) => sum + c.averageCodeQuality, 0) / organizationCommits.length;
    const avgDevLevel = organizationCommits.reduce((sum, c) => sum + c.averageDevLevel, 0) / organizationCommits.length;
    const avgComplexity = organizationCommits.reduce((sum, c) => sum + c.averageComplexity, 0) / organizationCommits.length;
    const avgAiPercent = organizationCommits.reduce((sum, c) => sum + (c.averageAiPercentage || 0), 0) / organizationCommits.length;
    
    // Calculate totals
    const totalHours = organizationCommits.reduce((sum, c) => sum + (c.averageEstimatedHours || 0), 0);
    const totalCost = organizationCommits.reduce((sum, c) => sum + (c.totalCost || 0), 0);
    
    // Update UI
    document.getElementById('avgQuality').textContent = avgQuality.toFixed(1);
    document.getElementById('avgDevLevel').textContent = avgDevLevel.toFixed(1) + ' (' + getDevLevel(avgDevLevel) + ')';
    document.getElementById('avgComplexity').textContent = avgComplexity.toFixed(1);
    document.getElementById('avgAiPercent').textContent = avgAiPercent.toFixed(0) + '%';
    document.getElementById('totalHours').textContent = totalHours.toFixed(0) + 'h';
    document.getElementById('totalCost').textContent = '$' + totalCost.toFixed(2);
}

// Display people section
function displayPeopleSection() {
    const memberMap = new Map();
    
    organizationCommits.forEach(commit => {
        if (!memberMap.has(commit.user)) {
            memberMap.set(commit.user, {
                user: commit.user,
                projects: new Set(),
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                qualitySum: 0,
                hoursSum: 0,
                lastActivity: null
            });
        }
        
        const stats = memberMap.get(commit.user);
        stats.projects.add(commit.project);
        stats.commits++;
        stats.linesAdded += commit.linesAdded || 0;
        stats.linesDeleted += commit.linesDeleted || 0;
        stats.qualitySum += commit.averageCodeQuality || 0;
        stats.hoursSum += commit.averageEstimatedHours || 0;
        
        const commitDate = new Date(commit.timestamp);
        if (!stats.lastActivity || commitDate > stats.lastActivity) {
            stats.lastActivity = commitDate;
        }
    });
    
    // Convert to array and sort by commits
    const members = Array.from(memberMap.values());
    members.sort((a, b) => b.commits - a.commits);
    
    // Display people grid
    const peopleGrid = document.getElementById('peopleGrid');
    peopleGrid.innerHTML = '';
    
    // Show all members in the grid
    members.forEach(member => {
        const memberAvatar = document.createElement('div');
        memberAvatar.className = 'member-avatar';
        memberAvatar.onclick = () => window.location.href = `/user-details.html?user=${encodeURIComponent(member.user)}`;
        
        // Create avatar with initial
        const initial = member.user.charAt(0).toUpperCase();
        memberAvatar.innerHTML = `
            <div class="avatar-initial">${initial}</div>
            <div class="member-tooltip">${member.user}</div>
        `;
        
        peopleGrid.appendChild(memberAvatar);
    });
    
    // Update the View all link with the organization name
    const viewAllLink = document.querySelector('.view-all-link');
    if (viewAllLink) {
        viewAllLink.href = `/organization-members.html?org=${encodeURIComponent(organizationName)}`;
    }
}

// Display projects table
function displayProjectsTable() {
    const projectMap = new Map();
    
    organizationCommits.forEach(commit => {
        if (!projectMap.has(commit.project)) {
            projectMap.set(commit.project, {
                project: commit.project,
                contributors: new Set(),
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                qualitySum: 0,
                hoursSum: 0,
                lastActivity: null
            });
        }
        
        const stats = projectMap.get(commit.project);
        stats.contributors.add(commit.user);
        stats.commits++;
        stats.linesAdded += commit.linesAdded || 0;
        stats.linesDeleted += commit.linesDeleted || 0;
        stats.qualitySum += commit.averageCodeQuality || 0;
        stats.hoursSum += commit.averageEstimatedHours || 0;
        
        const commitDate = new Date(commit.timestamp);
        if (!stats.lastActivity || commitDate > stats.lastActivity) {
            stats.lastActivity = commitDate;
        }
    });
    
    const tbody = document.getElementById('projectsBody');
    tbody.innerHTML = '';
    
    // Convert to array and sort by commits
    const projects = Array.from(projectMap.values());
    projects.sort((a, b) => b.commits - a.commits);
    
    projects.forEach(project => {
        const row = document.createElement('tr');
        row.className = 'clickable-row';
        row.onclick = () => window.location.href = `/project-details.html?project=${encodeURIComponent(project.project)}`;
        
        row.innerHTML = `
            <td>${project.project}</td>
            <td>${project.commits}</td>
            <td>${project.contributors.size}</td>
            <td>+${project.linesAdded.toLocaleString()}</td>
            <td>-${project.linesDeleted.toLocaleString()}</td>
            <td>${(project.qualitySum / project.commits).toFixed(1)}</td>
            <td>${project.hoursSum.toFixed(1)}h</td>
            <td>${project.lastActivity ? project.lastActivity.toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="view-details" onclick="event.stopPropagation(); window.location.href='/project-details.html?project=${encodeURIComponent(project.project)}'">
                    Details
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Display commits table
function displayCommitsTable() {
    const tbody = document.getElementById('orgCommitsBody');
    tbody.innerHTML = '';
    
    // Show only recent commits (limit to 100)
    const recentCommits = organizationCommits.slice(0, 100);
    
    recentCommits.forEach(commit => {
        const row = document.createElement('tr');
        row.className = 'clickable-row';
        row.onclick = () => window.location.href = `/details.html?hash=${commit.commitHash}`;
        
        const date = new Date(commit.timestamp);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${commit.commitHash.substring(0, 7)}</td>
            <td>${commit.user}</td>
            <td>${commit.project}</td>
            <td>${commit.commitMessage}</td>
            <td>${commit.filesChanged || 0}</td>
            <td>+${commit.linesAdded || 0}</td>
            <td>-${commit.linesDeleted || 0}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>
                <button class="view-details" onclick="event.stopPropagation(); window.location.href='/details.html?hash=${commit.commitHash}'">
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
    createProjectsChart();
    createContributorsChart();
}

// Create performance metrics chart
function createMetricsChart() {
    const ctx = document.getElementById('metricsChart').getContext('2d');
    
    // Calculate average metrics for the organization
    if (organizationCommits.length === 0) {
        return;
    }
    
    const avgQuality = organizationCommits.reduce((sum, c) => sum + (c.averageCodeQuality || 0), 0) / organizationCommits.length;
    const avgDevLevel = organizationCommits.reduce((sum, c) => sum + (c.averageDevLevel || 0), 0) / organizationCommits.length;
    const avgComplexity = organizationCommits.reduce((sum, c) => sum + (c.averageComplexity || 0), 0) / organizationCommits.length;
    const avgAiUsage = organizationCommits.reduce((sum, c) => sum + (c.aiPercentage || 0), 0) / organizationCommits.length;
    
    metricsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Code Quality', 'Dev Level', 'Complexity', 'AI Usage'],
            datasets: [{
                label: 'Average Score',
                data: [
                    avgQuality,
                    avgDevLevel * 1.67, // Scale dev level (0-3) to (0-5)
                    avgComplexity,
                    avgAiUsage / 20 // Scale AI usage (0-100) to (0-5)
                ],
                backgroundColor: [
                    'rgba(57, 255, 20, 0.6)',   // Green for quality
                    'rgba(255, 215, 0, 0.6)',   // Gold for dev level
                    'rgba(0, 191, 255, 0.6)',   // Blue for complexity
                    'rgba(255, 20, 147, 0.6)'   // Pink for AI usage
                ],
                borderColor: [
                    'rgba(57, 255, 20, 1)',
                    'rgba(255, 215, 0, 1)',
                    'rgba(0, 191, 255, 1)',
                    'rgba(255, 20, 147, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label;
                            let value = context.raw;
                            
                            // Format based on metric type
                            if (label === 'Dev Level') {
                                value = (value / 1.67).toFixed(1) + ' / 3';
                            } else if (label === 'AI Usage') {
                                value = (value * 20).toFixed(0) + '%';
                            } else {
                                value = value.toFixed(1) + ' / 5';
                            }
                            
                            return label + ': ' + value;
                        }
                    }
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

// Create projects chart
function createProjectsChart() {
    const ctx = document.getElementById('projectsChart').getContext('2d');
    
    // Gather comprehensive project stats
    const projectStats = {};
    organizationCommits.forEach(commit => {
        if (!projectStats[commit.project]) {
            projectStats[commit.project] = {
                commits: 0,
                contributors: new Set(),
                linesAdded: 0,
                totalHours: 0,
                avgQuality: 0,
                qualitySum: 0
            };
        }
        projectStats[commit.project].commits++;
        projectStats[commit.project].contributors.add(commit.user);
        projectStats[commit.project].linesAdded += commit.linesAdded || 0;
        projectStats[commit.project].totalHours += commit.estimatedHours || 0;
        projectStats[commit.project].qualitySum += commit.codeQuality || 0;
    });
    
    // Calculate averages and prepare bubble data
    const bubbleData = Object.entries(projectStats)
        .map(([project, stats]) => ({
            project,
            x: stats.contributors.size, // X-axis: number of contributors
            y: stats.commits, // Y-axis: number of commits
            r: Math.sqrt(stats.linesAdded) / 10, // Bubble size: based on lines of code
            avgQuality: stats.qualitySum / stats.commits,
            totalHours: stats.totalHours
        }))
        .sort((a, b) => b.y - a.y) // Sort by commits
        .slice(0, 10); // Top 10 projects
    
    projectsChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Projects',
                data: bubbleData.map(d => ({
                    x: d.x,
                    y: d.y,
                    r: Math.max(d.r, 5), // Minimum bubble size of 5
                    project: d.project,
                    avgQuality: d.avgQuality.toFixed(1),
                    totalHours: d.totalHours.toFixed(1)
                })),
                backgroundColor: bubbleData.map(d => {
                    // Color based on average quality
                    const quality = d.avgQuality;
                    if (quality >= 4) return 'rgba(57, 255, 20, 0.6)'; // Green
                    if (quality >= 3) return 'rgba(255, 193, 7, 0.6)'; // Yellow
                    return 'rgba(255, 69, 0, 0.6)'; // Red
                }),
                borderColor: bubbleData.map(d => {
                    const quality = d.avgQuality;
                    if (quality >= 4) return 'rgba(57, 255, 20, 1)';
                    if (quality >= 3) return 'rgba(255, 193, 7, 1)';
                    return 'rgba(255, 69, 0, 1)';
                }),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const data = context.raw;
                            return [
                                `Project: ${data.project}`,
                                `Contributors: ${data.x}`,
                                `Commits: ${data.y}`,
                                `Avg Quality: ${data.avgQuality}`,
                                `Total Hours: ${data.totalHours}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Number of Contributors',
                        color: '#c9d1d9'
                    },
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Commits',
                        color: '#c9d1d9'
                    },
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

// Create contributors leaderboard
function createContributorsChart() {
    // Count commits and calculate stats by user
    const userStats = {};
    organizationCommits.forEach(commit => {
        if (!userStats[commit.user]) {
            userStats[commit.user] = {
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                totalHours: 0
            };
        }
        userStats[commit.user].commits++;
        userStats[commit.user].linesAdded += commit.linesAdded || 0;
        userStats[commit.user].linesDeleted += commit.linesDeleted || 0;
        userStats[commit.user].totalHours += commit.estimatedHours || 0;
    });
    
    // Sort and get top 5
    const sortedUsers = Object.entries(userStats)
        .sort((a, b) => b[1].commits - a[1].commits)
        .slice(0, 5);
    
    // Build leaderboard HTML
    const leaderboardContainer = document.getElementById('contributorsLeaderboard');
    leaderboardContainer.innerHTML = '';
    
    // Always show 5 positions
    for (let i = 0; i < 5; i++) {
        if (i < sortedUsers.length) {
            // Real contributor
            const [username, stats] = sortedUsers[i];
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            
            const leaderboardItem = `
                <div class="leaderboard-item" onclick="window.location.href='/user-details.html?user=${encodeURIComponent(username)}'">
                    <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
                    <div class="leaderboard-user" title="${username}">${username}</div>
                    <div class="leaderboard-stats">
                        <div class="leaderboard-stat">
                            <div class="leaderboard-stat-value">${stats.commits}</div>
                            <div class="leaderboard-stat-label">commits</div>
                        </div>
                        <div class="leaderboard-stat">
                            <div class="leaderboard-stat-value">${formatNumber(stats.linesAdded)}</div>
                            <div class="leaderboard-stat-label">lines</div>
                        </div>
                    </div>
                </div>
            `;
            
            leaderboardContainer.innerHTML += leaderboardItem;
        } else {
            // Empty position
            const emptyItem = `
                <div class="leaderboard-item" style="opacity: 0.3; cursor: default;">
                    <div class="leaderboard-rank">${i + 1}</div>
                    <div class="leaderboard-user">—</div>
                    <div class="leaderboard-stats">
                        <div class="leaderboard-stat">
                            <div class="leaderboard-stat-value">0</div>
                            <div class="leaderboard-stat-label">commits</div>
                        </div>
                        <div class="leaderboard-stat">
                            <div class="leaderboard-stat-value">0</div>
                            <div class="leaderboard-stat-label">lines</div>
                        </div>
                    </div>
                </div>
            `;
            
            leaderboardContainer.innerHTML += emptyItem;
        }
    }
}

// Helper function to format large numbers
function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}


// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('commitsSearch');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#orgCommitsBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadOrganizationDetails();
    setupSearch();
});