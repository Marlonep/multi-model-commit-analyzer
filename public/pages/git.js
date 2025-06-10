// Remove authentication check for demo
// requireAdmin();

// Sample data structure for organizations and repositories
let organizations = [];
let currentOrgId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Load existing organizations
    await loadOrganizations();
    
    // Setup form submission
    setupFormListeners();
});

// Load organizations (mock data only - no database)
async function loadOrganizations() {
    // Always show demo data - no database interaction
    showDemoData();
}

// Show demo data when API is not available
function showDemoData() {
    organizations = [
        {
            id: 1,
            name: 'Nuclea-Solutions',
            provider: 'github',
            webhook_active: true,
            repositories: [
                {
                    id: 1,
                    name: 'multi-model-commit-analyzer',
                    full_name: 'Nuclea-Solutions/multi-model-commit-analyzer',
                    commits_analyzed: 66,
                    last_sync: '2024-01-06T10:30:00Z',
                    active: true
                }
            ]
        }
    ];
    renderOrganizationsTable();
    updateStats();
}

// Render organizations table
function renderOrganizationsTable() {
    const tbody = document.getElementById('organizationsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (organizations.length === 0) {
        tbody.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    tbody.style.display = '';
    emptyState.style.display = 'none';
    tbody.innerHTML = '';
    
    organizations.forEach(org => {
        // Create organization row
        const orgRow = document.createElement('tr');
        orgRow.className = 'org-row';
        orgRow.innerHTML = `
            <td>
                <div class="org-info">
                    <span class="material-icons expand-icon" onclick="toggleOrganization(${org.id})">
                        chevron_right
                    </span>
                    <span class="material-icons">business</span>
                    <span>${org.name}</span>
                </div>
            </td>
            <td>
                <span class="provider-badge ${org.provider}">
                    ${org.provider.charAt(0).toUpperCase() + org.provider.slice(1)}
                </span>
            </td>
            <td>
                <span class="webhook-status ${org.webhook_active ? 'active' : 'inactive'}">
                    <span class="material-icons">${org.webhook_active ? 'check_circle' : 'error'}</span>
                    ${org.webhook_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${getTotalCommits(org)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-secondary" onclick="syncOrganization(${org.id})">
                        <span class="material-icons">sync</span>
                        Sync
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="configureOrganization(${org.id})">
                        <span class="material-icons">settings</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(orgRow);
        
        // Create repository rows (hidden by default)
        if (org.repositories && org.repositories.length > 0) {
            org.repositories.forEach(repo => {
                const repoRow = document.createElement('tr');
                repoRow.className = 'repo-row';
                repoRow.id = `org-${org.id}-repos`;
                repoRow.style.display = 'none';
                
                // Determine repository status
                const repoStatus = repo.active ? 'active' : 'inactive';
                const statusColor = repo.active ? 'var(--accent-green)' : 'var(--error-color)';
                const statusText = repo.active ? 'Active' : 'Inactive';
                const statusIcon = repo.active ? 'check_circle' : 'cancel';
                
                repoRow.innerHTML = `
                    <td>
                        <div class="org-info">
                            <span class="material-icons">folder</span>
                            <span>${repo.name}</span>
                        </div>
                    </td>
                    <td>-</td>
                    <td>
                        <span class="webhook-status ${repoStatus}">
                            <span class="material-icons">${statusIcon}</span>
                            ${statusText}
                        </span>
                    </td>
                    <td>${repo.commits_analyzed || 0}</td>
                    <td>
                        <div class="action-buttons">
                            ${repo.active ? `
                                <button class="btn btn-small btn-secondary" onclick="toggleRepositoryStatus(${org.id}, ${repo.id})">
                                    <span class="material-icons">pause</span>
                                    Disable
                                </button>
                            ` : `
                                <button class="btn btn-small btn-secondary" onclick="toggleRepositoryStatus(${org.id}, ${repo.id})">
                                    <span class="material-icons">play_arrow</span>
                                    Enable
                                </button>
                            `}
                            <button class="btn btn-small btn-secondary" onclick="viewRepository('${repo.full_name}')">
                                <span class="material-icons">visibility</span>
                                View
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(repoRow);
            });
        }
    });
}

// Toggle organization expansion
function toggleOrganization(orgId) {
    const icon = event.target;
    const repoRows = document.querySelectorAll(`#org-${orgId}-repos`);
    
    if (icon.classList.contains('expanded')) {
        icon.classList.remove('expanded');
        icon.textContent = 'chevron_right';
        repoRows.forEach(row => row.style.display = 'none');
    } else {
        icon.classList.add('expanded');
        icon.textContent = 'expand_more';
        repoRows.forEach(row => row.style.display = '');
    }
}

// Update statistics
function updateStats() {
    document.getElementById('orgCount').textContent = organizations.length;
    
    let totalRepos = 0;
    let activeRepos = 0;
    let activeWebhooks = 0;
    
    organizations.forEach(org => {
        if (org.repositories) {
            totalRepos += org.repositories.length;
            activeRepos += org.repositories.filter(repo => repo.active).length;
        }
        if (org.webhook_active) {
            activeWebhooks++;
        }
    });
    
    document.getElementById('repoCount').textContent = `${activeRepos}/${totalRepos}`;
    document.getElementById('activeWebhooks').textContent = activeWebhooks;
    
    // Update last sync
    let lastSync = '--';
    organizations.forEach(org => {
        if (org.repositories) {
            org.repositories.forEach(repo => {
                if (repo.last_sync && repo.active) {
                    const syncTime = new Date(repo.last_sync);
                    if (lastSync === '--' || syncTime > new Date(lastSync)) {
                        lastSync = formatRelativeTime(syncTime);
                    }
                }
            });
        }
    });
    document.getElementById('lastSync').textContent = lastSync;
}

// Get total commits for an organization (only active repositories)
function getTotalCommits(org) {
    if (!org.repositories) return 0;
    return org.repositories
        .filter(repo => repo.active)
        .reduce((total, repo) => total + (repo.commits_analyzed || 0), 0);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return formatRelativeTime(date);
}

// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

// Setup form event listeners
function setupFormListeners() {
    const form = document.getElementById('addOrganizationForm');
    if (form) {
        // Remove existing listener to avoid duplicates
        form.removeEventListener('submit', handleAddOrganization);
        form.addEventListener('submit', handleAddOrganization);
        console.log('Form event listener attached'); // Debug log
    }
    
    const searchInput = document.getElementById('repoSearchInput');
    if (searchInput) {
        searchInput.removeEventListener('input', filterRepositories);
        searchInput.addEventListener('input', filterRepositories);
    }
}

// Modal functions
function openAddOrganizationModal() {
    const modal = document.getElementById('addOrganizationModal');
    modal.classList.add('show');
    
    // Set up event listeners when modal opens
    setTimeout(() => {
        setupFormListeners();
    }, 100); // Small delay to ensure DOM is ready
}

function closeAddOrganizationModal() {
    document.getElementById('addOrganizationModal').classList.remove('show');
    document.getElementById('addOrganizationForm').reset();
}

function openRepoSelectionModal() {
    document.getElementById('repoSelectionModal').classList.add('show');
}

function closeRepoSelectionModal() {
    document.getElementById('repoSelectionModal').classList.remove('show');
    currentOrgId = null;
}

// Backup form submit handler
function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Button clicked!'); // Debug log
    
    // Get form element directly
    const form = document.getElementById('addOrganizationForm');
    if (form) {
        handleAddOrganization({ target: form, preventDefault: () => {} });
    }
}

// Handle add organization form submission
async function handleAddOrganization(e) {
    e.preventDefault();
    console.log('Form submitted!'); // Debug log
    
    // Get form element - handle both form submit and button click
    const form = e.target.tagName === 'FORM' ? e.target : document.getElementById('addOrganizationForm');
    const formData = new FormData(form);
    const orgData = {
        name: formData.get('name'),
        provider: formData.get('provider'),
        token: formData.get('token')
    };
    
    console.log('Form data:', orgData); // Debug log
    
    // Validate required fields
    if (!orgData.name || !orgData.provider || !orgData.token) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Validating token...';
        submitBtn.disabled = true;
        
        // Mock API call to validate token and get repositories
        const response = await mockValidateTokenAPI(orgData);
        
        if (response.status === 'success') {
            // Store the token data temporarily for the modal
            window.tempOrgData = {
                name: orgData.name,
                provider: orgData.provider,
                repositories: response.repositories
            };
            
            // Close modal and open repository selection
            closeAddOrganizationModal();
            
            // Load repositories for selection (all checked by default)
            renderRepositoryListWithStatus(response.repositories);
            openRepoSelectionModal();
        } else {
            throw new Error(response.message || 'Token validation failed');
        }
        
        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Error validating token:', error);
        alert(`Failed to validate token: ${error.message}`);
        
        // Reset button state
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Create Organization';
        submitBtn.disabled = false;
    }
}

// Mock API endpoint for token validation
async function mockValidateTokenAPI(orgData) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock different responses based on provider
    if (orgData.provider === 'github') {
        // Simulate successful GitHub token validation
        return {
            status: 'success',
            message: 'Token validated successfully',
            repositories: [
                {
                    id: 1,
                    name: 'awesome-project',
                    full_name: `${orgData.name}/awesome-project`,
                    description: 'An awesome project that does amazing things',
                    private: false,
                    commits_analyzed: 0,
                    last_sync: null
                },
                {
                    id: 2,
                    name: 'secret-sauce',
                    full_name: `${orgData.name}/secret-sauce`,
                    description: 'Our secret sauce repository',
                    private: true,
                    commits_analyzed: 0,
                    last_sync: null
                },
                {
                    id: 3,
                    name: 'frontend-app',
                    full_name: `${orgData.name}/frontend-app`,
                    description: 'Main frontend application',
                    private: false,
                    commits_analyzed: 0,
                    last_sync: null
                },
                {
                    id: 4,
                    name: 'backend-api',
                    full_name: `${orgData.name}/backend-api`,
                    description: 'Backend API services',
                    private: false,
                    commits_analyzed: 0,
                    last_sync: null
                },
                {
                    id: 5,
                    name: 'mobile-app',
                    full_name: `${orgData.name}/mobile-app`,
                    description: 'React Native mobile application',
                    private: false,
                    commits_analyzed: 0,
                    last_sync: null
                }
            ]
        };
    } else {
        // Simulate error for other providers
        return {
            status: 'error',
            message: 'Provider not supported yet'
        };
    }
}

// Render repository list in modal with default checked status
function renderRepositoryListWithStatus(repos) {
    const repoList = document.getElementById('repoList');
    repoList.innerHTML = '';
    
    repos.forEach(repo => {
        const repoItem = document.createElement('div');
        repoItem.className = 'repo-item';
        repoItem.innerHTML = `
            <input type="checkbox" id="repo-${repo.id}" value="${repo.id}" checked onchange="updateSelectedCount()">
            <label for="repo-${repo.id}" class="repo-item-info">
                <div class="repo-name">${repo.name}</div>
                <div class="repo-description">${repo.description || 'No description'}</div>
            </label>
        `;
        repoList.appendChild(repoItem);
    });
    
    updateSelectedCount();
}

// Filter repositories based on search
function filterRepositories() {
    const searchTerm = document.getElementById('repoSearchInput').value.toLowerCase();
    const repoItems = document.querySelectorAll('.repo-item');
    
    repoItems.forEach(item => {
        const repoName = item.querySelector('.repo-name').textContent.toLowerCase();
        const repoDesc = item.querySelector('.repo-description').textContent.toLowerCase();
        
        if (repoName.includes(searchTerm) || repoDesc.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Update selected repository count
function updateSelectedCount() {
    const allBoxes = document.querySelectorAll('#repoList input[type="checkbox"]');
    const checkedBoxes = document.querySelectorAll('#repoList input[type="checkbox"]:checked');
    const totalCount = allBoxes.length;
    const selectedCount = checkedBoxes.length;
    document.getElementById('selectedCount').textContent = `${selectedCount} of ${totalCount} repos selected`;
}

// Sync selected repositories
async function syncSelectedRepositories() {
    const allBoxes = document.querySelectorAll('#repoList input[type="checkbox"]');
    const checkedBoxes = document.querySelectorAll('#repoList input[type="checkbox"]:checked');
    const uncheckedBoxes = document.querySelectorAll('#repoList input[type="checkbox"]:not(:checked)');
    
    if (checkedBoxes.length === 0) {
        alert('Please select at least one repository');
        return;
    }
    
    try {
        // Show loading state
        const syncBtn = document.querySelector('button[onclick="syncSelectedRepositories()"]');
        const originalText = syncBtn.textContent;
        syncBtn.textContent = 'Adding...';
        syncBtn.disabled = true;
        
        // Get the temporary organization data
        const tempData = window.tempOrgData;
        if (!tempData) {
            throw new Error('No organization data found');
        }
        
        // Create new organization with selected repositories
        const selectedRepos = [];
        const unselectedRepos = [];
        
        tempData.repositories.forEach(repo => {
            const checkbox = document.getElementById(`repo-${repo.id}`);
            if (checkbox && checkbox.checked) {
                selectedRepos.push({
                    ...repo,
                    active: true,
                    last_sync: new Date().toISOString()
                });
            } else {
                unselectedRepos.push({
                    ...repo,
                    active: false,
                    last_sync: null
                });
            }
        });
        
        // Add to organizations array (mock data)
        const newOrg = {
            id: organizations.length + 1,
            name: tempData.name,
            provider: tempData.provider,
            webhook_active: true,
            repositories: [...selectedRepos, ...unselectedRepos]
        };
        
        organizations.push(newOrg);
        
        // Clean up temporary data
        delete window.tempOrgData;
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        closeRepoSelectionModal();
        renderOrganizationsTable();
        updateStats();
        
        // Reset button state
        syncBtn.textContent = originalText;
        syncBtn.disabled = false;
        
        const activeCount = selectedRepos.length;
        const inactiveCount = unselectedRepos.length;
        alert(`Organization added successfully!\n${activeCount} repositories active, ${inactiveCount} repositories inactive.`);
        
    } catch (error) {
        console.error('Error adding organization:', error);
        alert('Failed to add organization. Please try again.');
        
        // Reset button state
        const syncBtn = document.querySelector('button[onclick="syncSelectedRepositories()"]');
        syncBtn.textContent = 'Continue';
        syncBtn.disabled = false;
    }
}

// Organization actions
async function syncOrganization(orgId) {
    try {
        // TODO: Make API call to sync organization
        console.log('Syncing organization:', orgId);
        alert('Organization sync started');
    } catch (error) {
        console.error('Error syncing organization:', error);
        alert('Failed to sync organization');
    }
}

function configureOrganization(orgId) {
    // TODO: Open configuration modal
    console.log('Configure organization:', orgId);
    alert('Organization configuration coming soon');
}

function viewRepository(repoFullName) {
    // Navigate to repository details or open in new tab
    console.log('View repository:', repoFullName);
    window.open(`https://github.com/${repoFullName}`, '_blank');
}

// Toggle repository active/inactive status
async function toggleRepositoryStatus(orgId, repoId) {
    try {
        const org = organizations.find(o => o.id === orgId);
        const repo = org.repositories.find(r => r.id === repoId);
        
        if (!repo) return;
        
        // Toggle status
        repo.active = !repo.active;
        repo.last_sync = repo.active ? new Date().toISOString() : null;
        
        // Re-render table to reflect changes
        renderOrganizationsTable();
        updateStats();
        
        const statusText = repo.active ? 'enabled' : 'disabled';
        console.log(`Repository ${repo.name} ${statusText}`);
        
    } catch (error) {
        console.error('Error toggling repository status:', error);
        alert('Failed to update repository status');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
};