// Fetch and display commit history
async function loadCommitHistory() {
    try {
        const response = await fetch('/api/commits');
        const commits = await response.json();
        
        displayBasicInfo(commits);
        displayScores(commits);
        displayCosts(commits);
    } catch (error) {
        console.error('Error loading commits:', error);
    }
}

// Display basic information table
function displayBasicInfo(commits) {
    const tbody = document.getElementById('basicInfoBody');
    tbody.innerHTML = '';
    
    commits.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${commit.commitHash.substring(0, 8)}</td>
            <td>${commit.user}</td>
            <td>${commit.project}</td>
            <td>${commit.fileChanges || 0}</td>
            <td>+${commit.linesAdded || 0}</td>
            <td>-${commit.linesDeleted || 0}</td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 40)}</td>
            <td>
                <button class="view-details" onclick="viewDetails(${index})">
                    View Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Display analysis scores table
function displayScores(commits) {
    const tbody = document.getElementById('scoresBody');
    tbody.innerHTML = '';
    
    commits.forEach(commit => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const devLevel = getDevLevel(commit.averageDevLevel);
        const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
        const savingsPercent = ((savings / commit.averageEstimatedHours) * 100).toFixed(0);
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${commit.averageEstimatedHours.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>${(commit.averageEstimatedHoursWithAi || 0).toFixed(1)}</td>
            <td>${savings.toFixed(1)}h (${savingsPercent}%)</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Display cost analysis table
function displayCosts(commits) {
    const tbody = document.getElementById('costBody');
    tbody.innerHTML = '';
    
    let grandTotalTokens = 0;
    let grandTotalCost = 0;
    
    commits.forEach(commit => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const tokens = commit.totalTokens || 0;
        const cost = commit.totalCost || 0;
        const avgCost = commit.avgCostPerModel || 0;
        
        grandTotalTokens += tokens;
        grandTotalCost += cost;
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${tokens.toLocaleString()}</td>
            <td>$${cost.toFixed(4)}</td>
            <td>$${avgCost.toFixed(4)}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update grand totals
    document.getElementById('totalTokens').textContent = grandTotalTokens.toLocaleString();
    document.getElementById('totalCost').textContent = `$${grandTotalCost.toFixed(4)}`;
    document.getElementById('avgCost').textContent = `$${(grandTotalCost / commits.length).toFixed(4)}`;
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

function viewDetails(index) {
    window.location.href = `/details.html?index=${index}`;
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', loadCommitHistory);