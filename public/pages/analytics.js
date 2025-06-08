// Check if user has permission to view analytics
function checkAnalyticsAccess() {
    if (!isAdmin()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

// Fetch and display organization analytics
async function loadAnalytics() {
    // Check permissions first
    if (!checkAnalyticsAccess()) {
        return;
    }
    try {
        const response = await fetch('/api/commits', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load commits');
        }
        
        const commits = await response.json();
        
        calculateOrganizationStats(commits);
        calculateCodeStats(commits);
        calculateProductivityMetrics(commits);
        loadOrganizationsTable(commits);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Calculate organization-wide statistics
function calculateOrganizationStats(commits) {
    const contributors = new Set();
    const projects = new Set();
    let totalHours = 0;
    
    commits.forEach(commit => {
        if (commit.user) contributors.add(commit.user);
        if (commit.project) projects.add(commit.project);
        totalHours += commit.averageEstimatedHours || 0;
    });
    
    document.getElementById('totalCommits').textContent = commits.length;
    document.getElementById('totalContributors').textContent = contributors.size;
    document.getElementById('totalProjects').textContent = projects.size;
    document.getElementById('totalHours').textContent = totalHours.toFixed(1) + 'h';
}

// Calculate code production statistics
function calculateCodeStats(commits) {
    let totalLinesAdded = 0;
    let totalLinesDeleted = 0;
    let totalFilesChanged = 0;
    const contributors = new Set();
    
    commits.forEach(commit => {
        totalLinesAdded += commit.linesAdded || 0;
        totalLinesDeleted += commit.linesDeleted || 0;
        totalFilesChanged += commit.fileChanges || 0;
        if (commit.user) contributors.add(commit.user);
    });
    
    const netLines = totalLinesAdded - totalLinesDeleted;
    const numContributors = contributors.size;
    const numCommits = commits.length;
    
    // Update totals
    document.getElementById('totalLinesAdded').textContent = '+' + totalLinesAdded.toLocaleString();
    document.getElementById('totalLinesDeleted').textContent = '-' + totalLinesDeleted.toLocaleString();
    document.getElementById('netLinesChanged').textContent = (netLines > 0 ? '+' : '') + netLines.toLocaleString();
    document.getElementById('totalFilesChanged').textContent = totalFilesChanged.toLocaleString();
    
    // Update averages per commit
    document.getElementById('avgLinesPerCommit').textContent = 
        '+' + Math.round(totalLinesAdded / numCommits).toLocaleString();
    document.getElementById('avgLinesDeletedPerCommit').textContent = 
        '-' + Math.round(totalLinesDeleted / numCommits).toLocaleString();
    document.getElementById('avgNetLinesPerCommit').textContent = 
        (netLines / numCommits > 0 ? '+' : '') + Math.round(netLines / numCommits).toLocaleString();
    document.getElementById('avgFilesPerCommit').textContent = 
        (totalFilesChanged / numCommits).toFixed(1);
    
    // Update averages per contributor
    document.getElementById('avgLinesPerContributor').textContent = 
        '+' + Math.round(totalLinesAdded / numContributors).toLocaleString();
    document.getElementById('avgLinesDeletedPerContributor').textContent = 
        '-' + Math.round(totalLinesDeleted / numContributors).toLocaleString();
    document.getElementById('avgNetLinesPerContributor').textContent = 
        (netLines / numContributors > 0 ? '+' : '') + Math.round(netLines / numContributors).toLocaleString();
    document.getElementById('avgFilesPerContributor').textContent = 
        Math.round(totalFilesChanged / numContributors).toLocaleString();
}

// Calculate productivity metrics
function calculateProductivityMetrics(commits) {
    let totalHours = 0;
    let totalAiHours = 0;
    let totalQuality = 0;
    let totalComplexity = 0;
    let totalDevLevel = 0;
    let totalAiPercentage = 0;
    let validCommits = 0;
    
    const devLevels = { Jr: 0, Mid: 0, Sr: 0 };
    
    commits.forEach(commit => {
        if (commit.averageEstimatedHours) {
            totalHours += commit.averageEstimatedHours;
            totalAiHours += commit.averageEstimatedHoursWithAi || 0;
            validCommits++;
        }
        if (commit.averageCodeQuality) totalQuality += commit.averageCodeQuality;
        if (commit.averageComplexity) totalComplexity += commit.averageComplexity;
        if (commit.averageDevLevel) {
            totalDevLevel += commit.averageDevLevel;
            const level = getDevLevel(commit.averageDevLevel);
            devLevels[level]++;
        }
        if (commit.averageAiPercentage) totalAiPercentage += commit.averageAiPercentage;
    });
    
    const avgQuality = (totalQuality / commits.length).toFixed(1);
    const avgComplexity = (totalComplexity / commits.length).toFixed(1);
    const avgDevLevel = (totalDevLevel / commits.length).toFixed(1);
    const avgAiPercentage = (totalAiPercentage / commits.length).toFixed(1);
    const hoursSaved = totalHours - totalAiHours;
    
    // Update metrics
    document.getElementById('totalDevHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('avgHoursPerCommit').textContent = (totalHours / validCommits).toFixed(1) + 'h';
    document.getElementById('avgAiUsage').textContent = avgAiPercentage + '%';
    document.getElementById('aiHoursSaved').textContent = hoursSaved.toFixed(1) + 'h saved';
    document.getElementById('avgQualityScore').textContent = avgQuality + '/5';
    document.getElementById('avgComplexity').textContent = avgComplexity + '/5';
    
    // Dev level distribution
    const total = devLevels.Jr + devLevels.Mid + devLevels.Sr;
    const distribution = `Jr: ${((devLevels.Jr/total)*100).toFixed(0)}%, Mid: ${((devLevels.Mid/total)*100).toFixed(0)}%, Sr: ${((devLevels.Sr/total)*100).toFixed(0)}%`;
    document.getElementById('devLevelDist').textContent = distribution;
    document.getElementById('avgDevLevel').textContent = `${avgDevLevel} (${getDevLevel(parseFloat(avgDevLevel))})`;
    
    // Quality trend
    const recentQuality = commits.slice(-5).reduce((sum, c) => sum + (c.averageCodeQuality || 0), 0) / 5;
    const qualityTrend = recentQuality > parseFloat(avgQuality) ? '📈 Improving' : '📉 Declining';
    document.getElementById('qualityTrend').textContent = qualityTrend;
    
    // Complexity distribution
    const lowComplex = commits.filter(c => c.averageComplexity && c.averageComplexity <= 2).length;
    const medComplex = commits.filter(c => c.averageComplexity && c.averageComplexity > 2 && c.averageComplexity <= 4).length;
    const highComplex = commits.filter(c => c.averageComplexity && c.averageComplexity > 4).length;
    document.getElementById('complexityDistribution').textContent = 
        `Low: ${lowComplex}, Med: ${medComplex}, High: ${highComplex}`;
}


// Load organizations table
function loadOrganizationsTable(commits) {
    // Group commits by organization
    const organizationMap = new Map();
    
    commits.forEach(commit => {
        const org = commit.organization || 'Unknown';
        
        if (!organizationMap.has(org)) {
            organizationMap.set(org, {
                organization: org,
                projects: new Set(),
                contributors: new Set(),
                commits: 0,
                linesAdded: 0,
                linesDeleted: 0,
                totalHours: 0,
                totalCost: 0,
                qualitySum: 0,
                aiPercentageSum: 0,
                lastCommitDate: null
            });
        }
        
        const stats = organizationMap.get(org);
        stats.projects.add(commit.project);
        stats.contributors.add(commit.user);
        stats.commits++;
        stats.linesAdded += commit.linesAdded || 0;
        stats.linesDeleted += commit.linesDeleted || 0;
        stats.totalHours += commit.averageEstimatedHours || 0;
        stats.totalCost += commit.totalCost || 0;
        stats.qualitySum += commit.averageCodeQuality || 0;
        stats.aiPercentageSum += commit.averageAiPercentage || 0;
        
        const commitDate = new Date(commit.timestamp);
        if (!stats.lastCommitDate || commitDate > stats.lastCommitDate) {
            stats.lastCommitDate = commitDate;
        }
    });
    
    // Convert to array and calculate averages
    const organizationStats = [];
    organizationMap.forEach(stats => {
        organizationStats.push({
            organization: stats.organization,
            projects: stats.projects.size,
            contributors: stats.contributors.size,
            commits: stats.commits,
            linesAdded: stats.linesAdded,
            linesDeleted: stats.linesDeleted,
            lastActivity: stats.lastCommitDate,
            avgQuality: stats.qualitySum / stats.commits,
            totalHours: stats.totalHours,
            avgAiPercentage: stats.aiPercentageSum / stats.commits,
            totalCost: stats.totalCost
        });
    });
    
    // Sort by number of commits descending
    organizationStats.sort((a, b) => b.commits - a.commits);
    
    displayOrganizationsTable(organizationStats);
    setupOrganizationsSearch();
}

// Display organizations in table
function displayOrganizationsTable(organizations) {
    const tbody = document.getElementById('organizationsBody');
    tbody.innerHTML = '';
    
    organizations.forEach(org => {
        const row = document.createElement('tr');
        row.className = 'clickable-row';
        row.onclick = () => window.location.href = `/pages/organization-details.html?org=${encodeURIComponent(org.organization)}`;
        
        row.innerHTML = `
            <td>${org.organization}</td>
            <td>${org.projects}</td>
            <td>${org.contributors}</td>
            <td>${org.commits}</td>
            <td>+${org.linesAdded.toLocaleString()}</td>
            <td>-${org.linesDeleted.toLocaleString()}</td>
            <td>${org.lastActivity ? new Date(org.lastActivity).toLocaleDateString() : 'N/A'}</td>
            <td>${org.avgQuality.toFixed(1)}</td>
            <td>${org.totalHours.toFixed(1)}h</td>
            <td>${org.avgAiPercentage.toFixed(0)}%</td>
            <td>$${org.totalCost.toFixed(2)}</td>
            <td>
                <button class="view-details" onclick="event.stopPropagation(); window.location.href='/organization-details.html?org=${encodeURIComponent(org.organization)}'">
                    Details
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search functionality for organizations table
function setupOrganizationsSearch() {
    const searchInput = document.getElementById('organizationsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#organizationsBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

// Helper function
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Auth check is handled by auth-utils.js
    // Only load analytics if user has permission
    if (checkAnalyticsAccess()) {
        loadAnalytics();
    }
});