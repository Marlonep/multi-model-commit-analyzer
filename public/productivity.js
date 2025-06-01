// Productivity Analysis Page
let allCommits = [];
let filteredCommits = [];
let githubConfig = null;

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

// Load and display commits
async function loadCommits() {
    try {
        await loadGithubConfig();
        
        const response = await fetch('/api/commits');
        allCommits = await response.json();
        
        // Sort commits by timestamp descending (latest first)
        allCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Initialize with all commits
        filteredCommits = [...allCommits];
        
        displayScores();
        setupSearch();
    } catch (error) {
        console.error('Error loading commits:', error);
    }
}

// Display analysis scores table
function displayScores() {
    const tbody = document.getElementById('scoresBody');
    tbody.innerHTML = '';
    
    filteredCommits.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const shortHash = commit.commitHash.substring(0, 8);
        
        // Calculate savings
        const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
        const savingsPercent = commit.averageEstimatedHours > 0 ? 
            Math.round((savings / commit.averageEstimatedHours) * 100) : 0;
        
        // Determine developer level
        const devLevel = commit.averageDevLevel <= 1.5 ? 'Jr' : 
                        commit.averageDevLevel <= 2.5 ? 'Mid' : 'Sr';
        
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
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${commit.averageEstimatedHours.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>${(commit.averageEstimatedHoursWithAi || 0).toFixed(1)}</td>
            <td>${savings.toFixed(1)}h (${savingsPercent}%)</td>
            <td>
                <button class="view-details" onclick="viewCommitDetails(${allCommits.indexOf(commit)})">
                    Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// View commit details
function viewCommitDetails(index) {
    window.location.href = `/details.html?index=${index}`;
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('scoresSearch');
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
                        new Date(commit.timestamp).toLocaleDateString(),
                        commit.averageCodeQuality.toFixed(1),
                        commit.averageDevLevel.toFixed(1),
                        commit.averageComplexity.toFixed(1),
                        commit.averageEstimatedHours.toFixed(1),
                        (commit.averageAiPercentage || 0).toFixed(0),
                        (commit.averageEstimatedHoursWithAi || 0).toFixed(1)
                    ].join(' ').toLowerCase();
                    
                    return searchableText.includes(searchTerm);
                });
            }
            
            displayScores();
        });
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', loadCommits);