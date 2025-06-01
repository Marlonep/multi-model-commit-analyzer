// Fetch and display project statistics
async function loadProjectStats() {
    try {
        const response = await fetch('/api/commits');
        const commits = await response.json();
        
        // Aggregate data by project
        const projectStats = aggregateProjectData(commits);
        
        // Display in table
        displayProjectStats(projectStats);
    } catch (error) {
        console.error('Error loading project stats:', error);
    }
}

// Aggregate commit data by project
function aggregateProjectData(commits) {
    const projectMap = new Map();
    
    commits.forEach(commit => {
        const project = commit.project || 'unknown';
        
        if (!projectMap.has(project)) {
            projectMap.set(project, {
                project: project,
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                lastCommit: null,
                totalQuality: 0,
                totalDevLevel: 0,
                totalComplexity: 0,
                totalHours: 0,
                totalAiPercentage: 0,
                contributors: new Set()
            });
        }
        
        const stats = projectMap.get(project);
        stats.commits++;
        stats.linesAdded += commit.linesAdded || 0;
        stats.linesDeleted += commit.linesDeleted || 0;
        
        // Track unique contributors
        if (commit.user) {
            stats.contributors.add(commit.user);
        }
        
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
    const projectStats = [];
    projectMap.forEach(stats => {
        projectStats.push({
            project: stats.project,
            commits: stats.commits,
            linesAdded: stats.linesAdded,
            linesDeleted: stats.linesDeleted,
            lastCommit: stats.lastCommit,
            avgQuality: stats.totalQuality / stats.commits,
            avgDevLevel: stats.totalDevLevel / stats.commits,
            avgComplexity: stats.totalComplexity / stats.commits,
            totalHours: stats.totalHours,
            avgAiPercentage: stats.totalAiPercentage / stats.commits,
            contributorCount: stats.contributors.size
        });
    });
    
    // Sort by number of commits (descending)
    return projectStats.sort((a, b) => b.commits - a.commits);
}

// Display project statistics in table
function displayProjectStats(projectStats) {
    const tbody = document.getElementById('projectsBody');
    tbody.innerHTML = '';
    
    projectStats.forEach(project => {
        const row = document.createElement('tr');
        const lastCommitDate = new Date(project.lastCommit).toLocaleDateString();
        const devLevel = getDevLevel(project.avgDevLevel);
        
        // Format project name (show full name if it's a path)
        const displayName = project.project === 'unknown' ? 
            '<span style="color: var(--text-secondary)">unknown</span>' : 
            project.project;
        
        row.innerHTML = `
            <td>${displayName}</td>
            <td>${project.commits}</td>
            <td>+${project.linesAdded.toLocaleString()}</td>
            <td>-${project.linesDeleted.toLocaleString()}</td>
            <td>${lastCommitDate}</td>
            <td>${project.avgQuality.toFixed(1)}/5</td>
            <td>${project.avgDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${project.avgComplexity.toFixed(1)}/5</td>
            <td>${project.totalHours.toFixed(1)}h</td>
            <td>${project.avgAiPercentage.toFixed(0)}%</td>
            <td>${getGitHubRepoButton(project.project)}</td>
            <td>
                <button class="view-details" onclick="viewProjectDetails('${encodeURIComponent(project.project)}')">
                    Details
                </button>
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

function getGitHubRepoButton(projectName) {
    if (projectName === 'unknown' || !projectName) {
        return '<span style="color: var(--text-secondary)">-</span>';
    }
    
    // Extract GitHub username from localStorage or use a default
    // In a real app, this would be configured or extracted from git config
    const githubUsername = localStorage.getItem('githubUsername') || 'Marlonep';
    const repoUrl = `https://github.com/${githubUsername}/${projectName}`;
    
    return `<a href="${repoUrl}" target="_blank" class="github-link">View Repo</a>`;
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadProjectStats();
    setupSearchFunctionality();
});

// Navigate to project details page
function viewProjectDetails(projectName) {
    window.location.href = `/project-details.html?project=${projectName}`;
}

// Search functionality
function setupSearchFunctionality() {
    const searchInput = document.getElementById('projectsSearch');
    const tableBody = document.getElementById('projectsBody');
    
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