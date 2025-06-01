let allCommits = [];
let filteredCommits = [];
let commitToDelete = null;
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

// Load and analyze commits
async function loadAlerts() {
    try {
        // Load GitHub config first
        await loadGithubConfig();
        
        const response = await fetch('/api/commits');
        allCommits = await response.json();
        
        // Analyze commits and assign status
        allCommits = allCommits.map(commit => {
            // Preserve existing status if already set, otherwise analyze
            if (commit.status && commit.manuallyReviewed) {
                // Keep existing manually set status
                return { 
                    ...commit, 
                    alertReason: commit.statusLog && commit.statusLog.length > 0 
                        ? 'Manually reviewed - ' + commit.statusLog[commit.statusLog.length - 1].reason
                        : 'Manually reviewed'
                };
            } else {
                // Analyze and set status
                const status = analyzeCommitStatus(commit);
                return { ...commit, status: status.status, alertReason: status.reason };
            }
        });
        
        // Update summary counts
        updateSummary();
        
        // Apply filters and display
        applyFilters();
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

// Analyze commit to determine status
function analyzeCommitStatus(commit) {
    // If commit has been manually reviewed and has a status, preserve it
    if (commit.manuallyReviewed && commit.status) {
        return {
            status: commit.status,
            reason: commit.statusLog && commit.statusLog.length > 0 
                ? 'Manually reviewed - ' + commit.statusLog[commit.statusLog.length - 1].reason
                : 'Manually reviewed'
        };
    }
    
    const reasons = [];
    let status = 'ok';
    
    // Check for extremely low quality
    if (commit.averageCodeQuality < 2) {
        reasons.push('Very low code quality');
        status = 'error';
    } else if (commit.averageCodeQuality < 3) {
        reasons.push('Low code quality');
        if (status === 'ok') status = 'abnormal';
    }
    
    // Check for extremely high complexity
    if (commit.averageComplexity > 4.5) {
        reasons.push('Very high complexity');
        status = 'error';
    } else if (commit.averageComplexity > 3.5) {
        reasons.push('High complexity');
        if (status === 'ok') status = 'abnormal';
    }
    
    // Check for unusual AI percentage
    if (commit.averageAiPercentage > 90) {
        reasons.push('Very high AI usage (>90%)');
        if (status === 'ok') status = 'abnormal';
    }
    
    // Check for very large commits
    const totalLines = (commit.linesAdded || 0) + (commit.linesDeleted || 0);
    if (totalLines > 5000) {
        reasons.push('Very large commit (>5000 lines)');
        status = 'error';
    } else if (totalLines > 2000) {
        reasons.push('Large commit (>2000 lines)');
        if (status === 'ok') status = 'abnormal';
    }
    
    // Check for unusual time estimates
    if (commit.averageEstimatedHours > 100) {
        reasons.push('Unusually high time estimate');
        if (status === 'ok') status = 'abnormal';
    }
    
    // Check for missing or invalid data
    if (!commit.user || commit.user === 'unknown') {
        reasons.push('Unknown user');
        if (status === 'ok') status = 'abnormal';
    }
    
    if (!commit.project || commit.project === 'unknown') {
        reasons.push('Unknown project');
        if (status === 'ok') status = 'abnormal';
    }
    
    // Check for suspicious patterns in commit message
    if (commit.commitMessage && (
        commit.commitMessage.toLowerCase().includes('test') ||
        commit.commitMessage.toLowerCase().includes('temp') ||
        commit.commitMessage.toLowerCase().includes('fix typo') && totalLines > 100
    )) {
        reasons.push('Suspicious commit message pattern');
        if (status === 'ok') status = 'abnormal';
    }
    
    return {
        status,
        reason: reasons.length > 0 ? reasons.join(', ') : 'No issues detected'
    };
}

// Update summary counts
function updateSummary() {
    const counts = {
        error: 0,
        abnormal: 0,
        ok: 0
    };
    
    allCommits.forEach(commit => {
        counts[commit.status]++;
    });
    
    document.getElementById('errorCount').textContent = counts.error;
    document.getElementById('abnormalCount').textContent = counts.abnormal;
    document.getElementById('okCount').textContent = counts.ok;
}

// Apply filters
function applyFilters() {
    const showError = document.getElementById('showError').checked;
    const showAbnormal = document.getElementById('showAbnormal').checked;
    const showOk = document.getElementById('showOk').checked;
    
    filteredCommits = allCommits.filter(commit => {
        if (commit.status === 'error' && showError) return true;
        if (commit.status === 'abnormal' && showAbnormal) return true;
        if (commit.status === 'ok' && showOk) return true;
        return false;
    });
    
    // Sort by status severity (error first, then abnormal, then ok)
    filteredCommits.sort((a, b) => {
        const statusOrder = { 'error': 0, 'abnormal': 1, 'ok': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
    });
    
    displayAlerts();
}

// Display alerts in table
function displayAlerts() {
    const tbody = document.getElementById('alertsBody');
    tbody.innerHTML = '';
    
    filteredCommits.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleString();
        
        // Add status class for styling
        row.className = `alert-row alert-${commit.status}`;
        
        // Get last status change info
        const lastStatusChange = commit.statusLog && commit.statusLog.length > 0 
            ? commit.statusLog[commit.statusLog.length - 1]
            : null;
        const lastModified = lastStatusChange 
            ? `${new Date(lastStatusChange.timestamp).toLocaleString()}<br><small>${lastStatusChange.changedBy || 'System'}</small>`
            : '-';
        
        row.innerHTML = `
            <td>
                <select class="status-select status-${commit.status}" 
                        onchange="changeCommitStatus('${commit.commitHash}', this.value, event)"
                        data-current="${commit.status}">
                    <option value="ok" ${commit.status === 'ok' ? 'selected' : ''}>OK</option>
                    <option value="abnormal" ${commit.status === 'abnormal' ? 'selected' : ''}>ABNORMAL</option>
                    <option value="error" ${commit.status === 'error' ? 'selected' : ''}>ERROR</option>
                </select>
            </td>
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
            <td>
                <a href="/project-details.html?project=${encodeURIComponent(commit.project)}" 
                   class="table-link" title="View Project Details">
                    ${commit.project}
                </a>
            </td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 30)}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td class="alert-reason">${commit.alertReason}</td>
            <td class="last-modified">${lastModified}</td>
            <td>
                <div class="action-buttons">
                    <button class="view-details" onclick="viewCommitDetails(${allCommits.indexOf(commit)})">
                        Details
                    </button>
                    <button class="btn-danger-small" onclick="openDeleteModal('${commit.commitHash}', '${commit.commitMessage.replace(/'/g, "\\'")}')">
                        Delete
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// View commit details
function viewCommitDetails(index) {
    window.location.href = `/details.html?index=${index}`;
}

// Open delete modal
function openDeleteModal(hash, message) {
    commitToDelete = hash;
    document.getElementById('deleteCommitHash').textContent = hash;
    document.getElementById('deleteCommitMessage').textContent = message;
    document.getElementById('confirmHash').value = '';
    document.getElementById('confirmDelete').disabled = true;
    document.getElementById('deleteModal').style.display = 'block';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    commitToDelete = null;
}

// Validate hash input
function validateHashInput() {
    const input = document.getElementById('confirmHash').value;
    const deleteButton = document.getElementById('confirmDelete');
    
    if (input === commitToDelete) {
        deleteButton.disabled = false;
    } else {
        deleteButton.disabled = true;
    }
}

// Confirm delete commit
async function confirmDeleteCommit() {
    if (!commitToDelete) return;
    
    try {
        const response = await fetch(`/api/commits/${commitToDelete}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Commit deleted successfully');
            closeDeleteModal();
            loadAlerts(); // Reload the data
        } else {
            alert('Error deleting commit');
        }
    } catch (error) {
        console.error('Error deleting commit:', error);
        alert('Error deleting commit');
    }
}

// Change commit status
async function changeCommitStatus(hash, newStatus, event) {
    // Find the select element
    const selectElement = event ? event.target : document.querySelector(`select[onchange*="${hash}"]`);
    const originalValue = selectElement.dataset.current;
    
    // Disable the select while updating
    selectElement.disabled = true;
    selectElement.style.opacity = '0.5';
    
    try {
        const response = await fetch(`/api/commits/${hash}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: newStatus,
                changedBy: 'User' // In a real app, this would be the logged-in user
            })
        });
        
        if (response.ok) {
            // Success - update the visual state immediately
            selectElement.className = `status-select status-${newStatus}`;
            selectElement.dataset.current = newStatus;
            
            // Show success feedback
            const row = selectElement.closest('tr');
            row.style.backgroundColor = 'rgba(57, 255, 20, 0.1)';
            setTimeout(() => {
                row.style.backgroundColor = '';
            }, 1000);
            
            // Reload the data to reflect all changes
            setTimeout(() => loadAlerts(), 1500);
        } else {
            const error = await response.json();
            alert('Error updating status: ' + error.error);
            // Revert the dropdown
            selectElement.value = originalValue;
            selectElement.disabled = false;
            selectElement.style.opacity = '1';
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status');
        // Revert the dropdown
        selectElement.value = originalValue;
        selectElement.disabled = false;
        selectElement.style.opacity = '1';
    }
}

// Helper functions
function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

// Setup event listeners
function setupEventListeners() {
    // Filter checkboxes
    document.getElementById('showError').addEventListener('change', applyFilters);
    document.getElementById('showAbnormal').addEventListener('change', applyFilters);
    document.getElementById('showOk').addEventListener('change', applyFilters);
    
    // Search functionality
    const searchInput = document.getElementById('alertsSearch');
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('#alertsBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
    
    // Hash confirmation input
    document.getElementById('confirmHash').addEventListener('input', validateHashInput);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('deleteModal');
        if (event.target === modal) {
            closeDeleteModal();
        }
    });
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadAlerts();
    setupEventListeners();
});