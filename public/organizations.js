// Load and display organizations
async function loadOrganizations() {
    try {
        const response = await fetch('/api/commits');
        const commits = await response.json();
        
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
        
        displayOrganizations(organizationStats);
    } catch (error) {
        console.error('Error loading organizations:', error);
        alert('Error loading organizations data');
    }
}

// Display organizations in table
function displayOrganizations(organizations) {
    const tbody = document.getElementById('organizationsBody');
    tbody.innerHTML = '';
    
    organizations.forEach(org => {
        const row = document.createElement('tr');
        row.className = 'clickable-row';
        row.onclick = () => window.location.href = `/organization-details.html?org=${encodeURIComponent(org.organization)}`;
        
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
                <button class="view-details-btn" onclick="event.stopPropagation(); window.location.href='/organization-details.html?org=${encodeURIComponent(org.organization)}'">
                    View Details
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('organizationsSearch');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#organizationsBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadOrganizations();
    setupSearch();
});