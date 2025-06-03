// Global variables
let allCommits = [];
let filteredCommits = [];
let githubConfig = null;

// Fetch GitHub configuration
async function loadGithubConfig() {
    try {
        const response = await fetch('/api/github-config', {
            headers: getAuthHeaders()
        });
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

// Load and display commits
async function loadCommits() {
    try {
        await loadGithubConfig();
        
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
        
        allCommits = await response.json();
        
        // Sort commits by timestamp descending (latest first)
        allCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Initialize filtered data
        filteredCommits = [...allCommits];
        
        displayComprehensive();
        setupSearch();
    } catch (error) {
        console.error('Error loading commits:', error);
    }
}

// Display comprehensive table with all data
function displayComprehensive() {
    const tbody = document.getElementById('comprehensiveBody');
    tbody.innerHTML = '';
    
    filteredCommits.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleString();
        const devLevel = getDevLevel(commit.averageDevLevel);
        const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
        const savingsPercent = commit.averageEstimatedHours > 0 ? 
            Math.round((savings / commit.averageEstimatedHours) * 100) : 0;
        const shortHash = commit.commitHash.substring(0, 8);
        
        row.innerHTML = `
            <td>${date}</td>
            <td>
                <a href="https://github.com/${githubConfig.username}/${githubConfig.repository}/commit/${commit.commitHash}" 
                   target="_blank" class="table-link" title="View on GitHub">
                    ${shortHash}
                </a>
            </td>
            <td>
                <a href="/user-details.html?user=${encodeURIComponent(commit.user)}" 
                   class="table-link" title="View User Details">
                    ${commit.user}
                </a>
            </td>
            <td>
                <a href="/project-details.html?project=${encodeURIComponent(commit.project)}" 
                   class="table-link" title="View Project Details">
                    ${commit.project}
                </a>
            </td>
            <td>${commit.organization || 'Unknown'}</td>
            <td>${commit.fileChanges}</td>
            <td>+${commit.linesAdded}</td>
            <td>-${commit.linesDeleted}</td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 30)}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${commit.averageEstimatedHours.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>${(commit.averageEstimatedHoursWithAi || 0).toFixed(1)}</td>
            <td>${savings.toFixed(1)}h (${savingsPercent}%)</td>
            <td>${(commit.totalTokens || 0).toLocaleString()}</td>
            <td>$${(commit.totalCost || 0).toFixed(4)}</td>
            <td>$${(commit.avgCostPerModel || 0).toFixed(4)}</td>
            <td>
                <div class="action-buttons">
                    <button class="view-details" onclick="viewCommitDetails(${allCommits.indexOf(commit)})">
                        Details
                    </button>
                </div>
            </td>
        `;
        
        // Add click handler for row (except on interactive elements)
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on links or buttons
            if (e.target.tagName === 'A' || 
                e.target.tagName === 'BUTTON' || 
                e.target.closest('a') ||
                e.target.closest('button')) {
                return;
            }
            
            // Navigate to commit details
            viewCommitDetails(allCommits.indexOf(commit));
        });
        
        // Add hover effect for clickable rows
        row.style.cursor = 'pointer';
        
        tbody.appendChild(row);
    });
}

// View commit details
function viewCommitDetails(index) {
    window.location.href = `/details.html?index=${index}`;
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

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('comprehensiveSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            
            if (searchTerm === '') {
                filteredCommits = [...allCommits];
            } else {
                filteredCommits = allCommits.filter(commit => {
                    const searchableText = [
                        commit.commitMessage,
                        commit.user,
                        commit.project,
                        commit.organization || '',
                        new Date(commit.timestamp).toLocaleString(),
                        commit.commitHash,
                        commit.averageCodeQuality.toFixed(1),
                        commit.averageDevLevel.toFixed(1),
                        commit.averageComplexity.toFixed(1)
                    ].join(' ').toLowerCase();
                    
                    return searchableText.includes(searchTerm);
                });
            }
            
            displayComprehensive();
        });
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', loadCommits);