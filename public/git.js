// Git Integrations Management
let organizations = [];
let selectedOrgs = new Map();

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadOrganizations();
});

// Load connected organizations
async function loadOrganizations() {
    try {
        const response = await fetch('/api/git/organizations', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            organizations = await response.json();
            displayOrganizations();
            updateGitHubStatus();
        } else if (response.status === 404) {
            // No organizations yet
            organizations = [];
            displayOrganizations();
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
        showNotification('Failed to load organizations', 'error');
    }
}

// Display organizations table
function displayOrganizations() {
    const container = document.getElementById('organizationsContainer');
    const emptyState = document.getElementById('emptyState');

    if (organizations.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';

    let html = `
        <div class="organizations-table">
            <table>
                <thead>
                    <tr>
                        <th width="40"></th>
                        <th>Organization</th>
                        <th>Repositories</th>
                        <th>Webhook Status</th>
                        <th>Last Sync</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    organizations.forEach((org, index) => {
        const isExpanded = org.expanded || false;
        
        // Organization row
        html += `
            <tr class="org-row" data-org-index="${index}">
                <td>
                    <span class="material-icons expand-icon ${isExpanded ? 'expanded' : ''}" 
                          onclick="toggleOrganization(${index})">
                        chevron_right
                    </span>
                </td>
                <td>
                    <div class="org-info">
                        <img src="https://github.com/${org.name}.png?size=32" 
                             alt="${org.name}" 
                             style="width: 32px; height: 32px; border-radius: 4px;">
                        <span>${org.name}</span>
                    </div>
                </td>
                <td>${org.repositories.length} repositories</td>
                <td>
                    <span class="webhook-status ${org.webhookActive ? 'active' : 'inactive'}">
                        ${org.webhookActive ? '✓ Active' : '○ Inactive'}
                    </span>
                </td>
                <td>${org.lastSync ? new Date(org.lastSync).toLocaleString() : 'Never'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon primary" onclick="syncOrganization('${org.name}')" title="Sync">
                            <span class="material-icons">sync</span>
                        </button>
                        <button class="btn-icon secondary" onclick="configureOrganization('${org.name}')" title="Configure">
                            <span class="material-icons">settings</span>
                        </button>
                        <button class="btn-icon danger" onclick="removeOrganization('${org.name}')" title="Remove">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;

        // Repository rows (if expanded)
        if (isExpanded && org.repositories) {
            org.repositories.forEach(repo => {
                html += `
                    <tr class="repo-row" style="display: ${isExpanded ? 'table-row' : 'none'};">
                        <td></td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="material-icons" style="font-size: 16px; color: var(--text-secondary);">
                                    ${repo.private ? 'lock' : 'public'}
                                </span>
                                <a href="https://github.com/${org.name}/${repo.name}" 
                                   target="_blank" 
                                   style="color: var(--primary-color); text-decoration: none;">
                                    ${repo.name}
                                </a>
                            </div>
                        </td>
                        <td colspan="2" style="color: var(--text-secondary); font-size: 14px;">
                            ${repo.description || 'No description'}
                        </td>
                        <td>${repo.lastCommitAnalyzed ? new Date(repo.lastCommitAnalyzed).toLocaleString() : 'Not analyzed'}</td>
                        <td>
                            <button class="btn-icon secondary" onclick="analyzeRepository('${org.name}', '${repo.name}')" title="Analyze Now">
                                <span class="material-icons">play_arrow</span>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// Toggle organization expansion
function toggleOrganization(index) {
    organizations[index].expanded = !organizations[index].expanded;
    displayOrganizations();
}

// Update GitHub connection status
function updateGitHubStatus() {
    const statusEl = document.getElementById('githubStatus');
    if (organizations.length > 0) {
        statusEl.textContent = `Connected (${organizations.length} organizations)`;
        statusEl.className = 'provider-status connected';
    } else {
        statusEl.textContent = 'Not connected';
        statusEl.className = 'provider-status disconnected';
    }
}

// Show integration modal
function showIntegrationModal() {
    document.getElementById('integrationModal').style.display = 'block';
    document.getElementById('githubApiKey').focus();
}

// Hide integration modal
function hideIntegrationModal() {
    document.getElementById('integrationModal').style.display = 'none';
    document.getElementById('githubApiKey').value = '';
    document.getElementById('discoveryResults').style.display = 'none';
    document.getElementById('integrationProgress').classList.remove('show');
    selectedOrgs.clear();
}

// Discover organizations
async function discoverOrganizations() {
    const apiKey = document.getElementById('githubApiKey').value.trim();
    if (!apiKey) {
        showNotification('Please enter a GitHub API key', 'error');
        return;
    }

    const discoverBtn = document.getElementById('discoverBtn');
    discoverBtn.disabled = true;
    discoverBtn.innerHTML = '<span class="spinner"></span> Discovering...';

    try {
        const response = await fetch('/api/keys/scan', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key: apiKey })
        });

        if (!response.ok) {
            throw new Error('Failed to discover organizations');
        }

        const data = await response.json();
        displayDiscoveryResults(data);
    } catch (error) {
        console.error('Error discovering organizations:', error);
        showNotification('Failed to discover organizations. Please check your API key.', 'error');
    } finally {
        discoverBtn.disabled = false;
        discoverBtn.innerHTML = 'Discover Organizations';
    }
}

// Display discovery results
function displayDiscoveryResults(data) {
    const resultsDiv = document.getElementById('discoveryResults');
    const orgListDiv = document.getElementById('orgList');
    
    resultsDiv.style.display = 'block';
    orgListDiv.innerHTML = '';

    if (!data.orgs || data.orgs.length === 0) {
        orgListDiv.innerHTML = '<p>No organizations found. Make sure your token has the correct permissions.</p>';
        return;
    }

    data.orgs.forEach(org => {
        const orgDiv = document.createElement('div');
        orgDiv.className = 'org-selection';
        
        orgDiv.innerHTML = `
            <div class="org-selection-header" onclick="toggleOrgRepos('${org.id}')">
                <input type="checkbox" 
                       id="org-${org.id}" 
                       onclick="event.stopPropagation(); selectOrganization('${org.id}', this.checked)">
                <img src="https://github.com/${org.name}.png?size=24" 
                     alt="${org.name}" 
                     style="width: 24px; height: 24px; border-radius: 4px;">
                <label for="org-${org.id}" style="flex: 1; cursor: pointer;" onclick="event.stopPropagation();">
                    ${org.name} (${org.repositories.length} repositories)
                </label>
                <span class="material-icons expand-icon" id="expand-${org.id}">
                    chevron_right
                </span>
            </div>
            <div class="repo-list" id="repos-${org.id}">
                ${org.repositories.map(repo => `
                    <div class="repo-item">
                        <input type="checkbox" 
                               id="repo-${org.id}-${repo.id}" 
                               data-org="${org.id}" 
                               data-repo="${repo.name}"
                               onclick="selectRepository('${org.id}', '${repo.id}', this.checked)">
                        <label for="repo-${org.id}-${repo.id}" style="flex: 1; cursor: pointer;">
                            <span class="material-icons" style="font-size: 16px; vertical-align: middle;">
                                ${repo.private ? 'lock' : 'public'}
                            </span>
                            ${repo.name}
                        </label>
                    </div>
                `).join('')}
            </div>
        `;
        
        orgListDiv.appendChild(orgDiv);
        
        // Store org data
        selectedOrgs.set(org.id, {
            name: org.name,
            repositories: new Set(),
            data: org
        });
    });
}

// Toggle organization repos visibility
function toggleOrgRepos(orgId) {
    const repoList = document.getElementById(`repos-${orgId}`);
    const expandIcon = document.getElementById(`expand-${orgId}`);
    
    if (repoList.classList.contains('show')) {
        repoList.classList.remove('show');
        expandIcon.classList.remove('expanded');
    } else {
        repoList.classList.add('show');
        expandIcon.classList.add('expanded');
    }
}

// Select/deselect organization
function selectOrganization(orgId, selected) {
    const org = selectedOrgs.get(orgId);
    if (!org) return;
    
    // Update all repo checkboxes
    const repoCheckboxes = document.querySelectorAll(`input[data-org="${orgId}"]`);
    repoCheckboxes.forEach(cb => {
        cb.checked = selected;
        if (selected) {
            org.repositories.add(cb.dataset.repo);
        } else {
            org.repositories.clear();
        }
    });
}

// Select/deselect repository
function selectRepository(orgId, repoId, selected) {
    const org = selectedOrgs.get(orgId);
    if (!org) return;
    
    const repoCheckbox = document.getElementById(`repo-${orgId}-${repoId}`);
    if (selected) {
        org.repositories.add(repoCheckbox.dataset.repo);
    } else {
        org.repositories.delete(repoCheckbox.dataset.repo);
    }
    
    // Update org checkbox based on repo selections
    const orgCheckbox = document.getElementById(`org-${orgId}`);
    const allRepoCheckboxes = document.querySelectorAll(`input[data-org="${orgId}"]`);
    const checkedRepos = document.querySelectorAll(`input[data-org="${orgId}"]:checked`);
    
    if (checkedRepos.length === 0) {
        orgCheckbox.checked = false;
        orgCheckbox.indeterminate = false;
    } else if (checkedRepos.length === allRepoCheckboxes.length) {
        orgCheckbox.checked = true;
        orgCheckbox.indeterminate = false;
    } else {
        orgCheckbox.checked = false;
        orgCheckbox.indeterminate = true;
    }
}

// Setup integrations
async function setupIntegrations() {
    const apiKey = document.getElementById('githubApiKey').value.trim();
    const setupBtn = document.getElementById('setupBtn');
    const progressDiv = document.getElementById('integrationProgress');
    const progressItems = document.getElementById('progressItems');
    
    // Collect selected organizations and repositories
    const selections = [];
    selectedOrgs.forEach((org, orgId) => {
        if (org.repositories.size > 0) {
            selections.push({
                id: orgId,
                name: org.name,
                repositories: Array.from(org.repositories).map(repoName => {
                    const repo = org.data.repositories.find(r => r.name === repoName);
                    return {
                        id: repo.id,
                        name: repo.name,
                        full_name: repo.full_name
                    };
                })
            });
        }
    });
    
    if (selections.length === 0) {
        showNotification('Please select at least one organization or repository', 'error');
        return;
    }
    
    setupBtn.disabled = true;
    progressDiv.classList.add('show');
    progressItems.innerHTML = '';
    
    // Add progress items
    selections.forEach(org => {
        progressItems.innerHTML += `
            <div class="progress-item" id="progress-${org.id}">
                <span class="spinner"></span>
                <span>Setting up ${org.name} (${org.repositories.length} repositories)</span>
            </div>
        `;
    });
    
    try {
        const response = await fetch('/api/keys/selection', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: apiKey,
                organizations: selections
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to setup integrations');
        }
        
        // Mark all as complete
        selections.forEach(org => {
            const item = document.getElementById(`progress-${org.id}`);
            item.classList.add('complete');
            item.innerHTML = `
                <span class="material-icons" style="color: var(--success-color);">check_circle</span>
                <span>✓ ${org.name} integrated successfully</span>
            `;
        });
        
        showNotification('Integrations setup successfully!', 'success');
        
        // Reload organizations after a short delay
        setTimeout(() => {
            hideIntegrationModal();
            loadOrganizations();
        }, 2000);
        
    } catch (error) {
        console.error('Error setting up integrations:', error);
        showNotification('Failed to setup integrations', 'error');
        
        // Mark as error
        selections.forEach(org => {
            const item = document.getElementById(`progress-${org.id}`);
            item.classList.add('error');
            item.innerHTML = `
                <span class="material-icons" style="color: var(--danger-color);">error</span>
                <span>Failed to setup ${org.name}</span>
            `;
        });
    } finally {
        setupBtn.disabled = false;
    }
}

// Sync organization
async function syncOrganization(orgName) {
    if (!confirm(`Sync all repositories for ${orgName}? This may take a while.`)) {
        return;
    }
    
    showNotification(`Syncing ${orgName}...`, 'info');
    
    try {
        const response = await fetch(`/api/git/organizations/${orgName}/sync`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            showNotification(`Successfully synced ${orgName}`, 'success');
            loadOrganizations();
        } else {
            throw new Error('Sync failed');
        }
    } catch (error) {
        console.error('Error syncing organization:', error);
        showNotification(`Failed to sync ${orgName}`, 'error');
    }
}

// Configure organization
function configureOrganization(orgName) {
    // TODO: Implement organization configuration
    showNotification('Organization configuration coming soon', 'info');
}

// Remove organization
async function removeOrganization(orgName) {
    if (!confirm(`Remove ${orgName} and all its repositories? This cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/git/organizations/${orgName}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            showNotification(`Successfully removed ${orgName}`, 'success');
            loadOrganizations();
        } else {
            throw new Error('Remove failed');
        }
    } catch (error) {
        console.error('Error removing organization:', error);
        showNotification(`Failed to remove ${orgName}`, 'error');
    }
}

// Analyze repository
async function analyzeRepository(orgName, repoName) {
    showNotification(`Analyzing ${repoName}...`, 'info');
    
    try {
        const response = await fetch(`/api/git/organizations/${orgName}/repositories/${repoName}/analyze`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Analysis complete: ${result.commits} commits analyzed`, 'success');
        } else {
            throw new Error('Analysis failed');
        }
    } catch (error) {
        console.error('Error analyzing repository:', error);
        showNotification(`Failed to analyze ${repoName}`, 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else {
        notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('integrationModal');
    if (event.target === modal) {
        hideIntegrationModal();
    }
});