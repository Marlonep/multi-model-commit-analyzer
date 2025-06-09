// Get organization name from URL
const urlParams = new URLSearchParams(window.location.search);
const organizationName = urlParams.get('org');
let organizationCommits = [];

// Chart instances
let activityChart = null;
let projectsChart = null;
let contributorsChart = null;
let qualityTrendsChart = null;

// Helper function to get dev level string
function getDevLevel(level) {
    if (level >= 9) return 'Expert';
    if (level >= 7) return 'Senior';
    if (level >= 5) return 'Mid-level';
    if (level >= 3) return 'Junior';
    return 'Beginner';
}

// Load organization details
async function loadOrganizationDetails() {
    if (!organizationName) {
        window.location.href = '/analytics.html';
        return;
    }

    try {
        // Fetch all commits
        const response = await fetch('/api/commits');
        const allCommits = await response.json();
        
        // Filter commits for this organization
        organizationCommits = allCommits.filter(commit => 
            (commit.organization || 'Unknown') === organizationName
        );
        
        // Sort by date descending
        organizationCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayOrganizationInfo();
        displayOrganizationStats();
        displayMembersTable();
        displayProjectsTable();
        displayCommitsTable();
        createCharts();
    } catch (error) {
        console.error('Error loading organization details:', error);
        alert('Error loading organization details');
        window.location.href = '/analytics.html';
    }
}

// Display organization information
function displayOrganizationInfo() {
    document.getElementById('organizationName').textContent = organizationName;
    
    // Set GitHub organization link (assuming org name matches GitHub)
    if (organizationName !== 'Unknown') {
        document.getElementById('githubOrgLink').href = `https://github.com/${organizationName}`;
    } else {
        document.getElementById('githubOrgLink').style.display = 'none';
    }
    
    // Count unique projects
    const projects = new Set(organizationCommits.map(c => c.project));
    document.getElementById('totalProjects').textContent = projects.size;
    
    // Count unique contributors
    const contributors = new Set(organizationCommits.map(c => c.user));
    document.getElementById('totalContributors').textContent = contributors.size;
    
    document.getElementById('totalCommits').textContent = organizationCommits.length;
    
    // Find earliest commit date
    if (organizationCommits.length > 0) {
        const earliestDate = new Date(Math.min(...organizationCommits.map(c => new Date(c.timestamp))));
        document.getElementById('activeSince').textContent = earliestDate.toLocaleDateString();
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

// Display members table
function displayMembersTable() {
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
    
    const tbody = document.getElementById('membersBody');
    tbody.innerHTML = '';
    
    // Convert to array and sort by commits
    const members = Array.from(memberMap.values());
    members.sort((a, b) => b.commits - a.commits);
    
    members.forEach(member => {
        const row = document.createElement('tr');
        row.className = 'clickable-row';
        row.onclick = () => window.location.href = `/user-details.html?user=${encodeURIComponent(member.user)}`;
        
        row.innerHTML = `
            <td>${member.user}</td>
            <td>${member.projects.size}</td>
            <td>${member.commits}</td>
            <td>+${member.linesAdded.toLocaleString()}</td>
            <td>-${member.linesDeleted.toLocaleString()}</td>
            <td>${(member.qualitySum / member.commits).toFixed(1)}</td>
            <td>${member.hoursSum.toFixed(1)}h</td>
            <td>${member.lastActivity ? member.lastActivity.toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="view-details" onclick="event.stopPropagation(); window.location.href='/user-details.html?user=${encodeURIComponent(member.user)}'">
                    Details
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
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
    createActivityChart();
    createProjectsChart();
    createContributorsChart();
    createQualityTrendsChart();
}

// Create activity timeline chart
function createActivityChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    // Group commits by date
    const commitsByDate = {};
    organizationCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        commitsByDate[date] = (commitsByDate[date] || 0) + 1;
    });
    
    // Sort dates
    const dates = Object.keys(commitsByDate).sort((a, b) => new Date(a) - new Date(b));
    const last30Days = dates.slice(-30);
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Days,
            datasets: [{
                label: 'Commits',
                data: last30Days.map(date => commitsByDate[date]),
                borderColor: '#00ff41',
                backgroundColor: 'rgba(0, 255, 65, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Create projects chart
function createProjectsChart() {
    const ctx = document.getElementById('projectsChart').getContext('2d');
    
    // Count commits by project
    const projectCounts = {};
    organizationCommits.forEach(commit => {
        projectCounts[commit.project] = (projectCounts[commit.project] || 0) + 1;
    });
    
    // Sort and get top 10
    const sortedProjects = Object.entries(projectCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    projectsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedProjects.map(([project]) => project),
            datasets: [{
                label: 'Commits',
                data: sortedProjects.map(([, count]) => count),
                backgroundColor: '#00ff41'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Create contributors chart
function createContributorsChart() {
    const ctx = document.getElementById('contributorsChart').getContext('2d');
    
    // Count commits by user
    const userCounts = {};
    organizationCommits.forEach(commit => {
        userCounts[commit.user] = (userCounts[commit.user] || 0) + 1;
    });
    
    // Sort and get top 10
    const sortedUsers = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    contributorsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedUsers.map(([user]) => user),
            datasets: [{
                label: 'Commits',
                data: sortedUsers.map(([, count]) => count),
                backgroundColor: '#00ff41'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Create quality trends chart
function createQualityTrendsChart() {
    const ctx = document.getElementById('qualityTrendsChart').getContext('2d');
    
    // Group by month and calculate average quality
    const qualityByMonth = {};
    organizationCommits.forEach(commit => {
        const month = new Date(commit.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!qualityByMonth[month]) {
            qualityByMonth[month] = { sum: 0, count: 0 };
        }
        qualityByMonth[month].sum += commit.averageCodeQuality;
        qualityByMonth[month].count++;
    });
    
    // Sort months and calculate averages
    const months = Object.keys(qualityByMonth).sort((a, b) => new Date(a) - new Date(b));
    const avgQualities = months.map(month => 
        qualityByMonth[month].sum / qualityByMonth[month].count
    );
    
    qualityTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Average Code Quality',
                data: avgQualities,
                borderColor: '#00ff41',
                backgroundColor: 'rgba(0, 255, 65, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10
                }
            }
        }
    });
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