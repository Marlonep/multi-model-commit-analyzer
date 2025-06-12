// Remove authentication check for demo
// requireAdmin();

// Sample data structure for organizations and repositories
let organizations = [];
let currentOrgId = null;

// Helper function to get last 4 characters of token
function getTokenSuffix(token) {
    if (!token || token.length < 4) return '••••';
    return token.slice(-4);
}

// Helper function to generate provider URLs
function getProviderOrgUrl(provider, orgName) {
    switch (provider) {
        case 'github':
            return `https://github.com/${orgName}`;
        case 'gitlab':
            return `https://gitlab.com/${orgName}`;
        case 'bitbucket':
            return `https://bitbucket.org/${orgName}`;
        default:
            return '#';
    }
}

function getProviderRepoUrl(provider, repoFullName) {
    switch (provider) {
        case 'github':
            return `https://github.com/${repoFullName}`;
        case 'gitlab':
            return `https://gitlab.com/${repoFullName}`;
        case 'bitbucket':
            return `https://bitbucket.org/${repoFullName}`;
        default:
            return '#';
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Load existing organizations
    await loadOrganizations();

    // Setup form submission
    setupFormListeners();
});

// Load organizations from database
async function loadOrganizations() {
    try {
        const response = await fetch('/api/git/organizations');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.organizations) {
                // Transform API data to match frontend format
                organizations = result.organizations.map(org => ({
                    id: org.id,
                    name: org.name,
                    provider: org.provider,
                    token: `••••${org.token_suffix || '••••'}`,
                    webhook_active: org.webhook_active,
                    date_added: org.created_at,
                    added_by: 'System', // TODO: Get actual user info
                    repositories: org.repositories.map(repo => ({
                        id: repo.id,
                        name: repo.name,
                        full_name: repo.full_name,
                        description: repo.description,
                        commits_analyzed: repo.commits_analyzed,
                        last_sync: repo.last_sync,
                        active: repo.active,
                        enabled: repo.enabled,
                        date_added: org.created_at,
                        added_by: 'System'
                    }))
                }));

                renderOrganizationsTable();
                updateStats();
                return;
            }
        }

        // Fall back to demo data if API fails
        console.warn('Failed to load organizations from API, showing demo data');
        showDemoData();
    } catch (error) {
        console.error('Error loading organizations:', error);
        // Fall back to demo data if there's an error
        showDemoData();
    }
}

// Show demo data when API is not available
function showDemoData() {
    organizations = [
        {
            id: 1,
            name: 'Nuclea-Solutions',
            provider: 'github',
            token: 'ghp_demotoken1234567890abcdef',
            webhook_active: true,
            date_added: '2024-01-05T14:20:00Z',
            added_by: 'admin@nuclea.com',
            repositories: [
                {
                    id: 1,
                    name: 'multi-model-commit-analyzer',
                    full_name: 'Nuclea-Solutions/multi-model-commit-analyzer',
                    commits_analyzed: 66,
                    last_sync: '2024-01-06T10:30:00Z',
                    active: true,
                    date_added: '2024-01-05T14:20:00Z',
                    added_by: 'admin@nuclea.com'
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
                    <a href="${getProviderOrgUrl(org.provider, org.name)}" target="_blank" class="org-link">${org.name}</a>
                </div>
            </td>
            <td>
                <span class="provider-badge ${org.provider}">
                    ${org.provider.charAt(0).toUpperCase() + org.provider.slice(1)}
                </span>
            </td>
            <td>
                <span class="token-display">•••${getTokenSuffix(org.token)}</span>
            </td>
            <td>
                <span class="webhook-status ${org.webhook_active ? 'active' : 'inactive'}">
                    <span class="material-icons">${org.webhook_active ? 'check_circle' : 'error'}</span>
                    ${org.webhook_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${getTotalCommits(org)}</td>
            <td>${formatDate(org.date_added)}</td>
            <td>${org.added_by || 'Unknown'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); openDeleteOrganizationModal(${org.id})">
                        <span class="material-icons">delete</span>
                        Delete
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
                            <a href="${getProviderRepoUrl(org.provider, repo.full_name)}" target="_blank" class="repo-link">${repo.name}</a>
                        </div>
                    </td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <span class="webhook-status ${repoStatus}">
                            <span class="material-icons">${statusIcon}</span>
                            ${statusText}
                        </span>
                    </td>
                    <td>${repo.commits_analyzed || 0}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <div class="action-buttons">
                            ${repo.active ? `
                                <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); startRepositoryAnalysis(${org.id}, ${repo.id})">
                                    <span class="material-icons">analytics</span>
                                    Analyze
                                </button>
                                <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); openDeactivateRepoModal(${org.id}, ${repo.id})">
                                    <span class="material-icons">pause</span>
                                    Disable
                                </button>
                            ` : `
                                <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); openActivateRepoModal(${org.id}, ${repo.id})">
                                    <span class="material-icons">play_arrow</span>
                                    Enable
                                </button>
                            `}
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
        handleAddOrganization({ target: form, preventDefault: () => { } });
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

        // Call the /api/keys/scan endpoint
        const response = await fetch('/api/keys/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key_name: orgData.name,
                provider: orgData.provider,
                token: orgData.token
            })
        });

        if (!response.ok) {
            throw new Error('Failed to validate token');
        }

        const result = await response.json();

        if (result.data && result.data.orgs) {
            // Process the organizations and repositories from the API
            const allRepos = [];
            result.data.orgs.forEach(org => {
                if (org.repositories && org.repositories.length > 0) {
                    org.repositories.forEach(repo => {
                        allRepos.push({
                            id: repo.id,
                            name: repo.name,
                            full_name: repo.full_name,
                            description: repo.description || 'No description available',
                            private: repo.private,
                            org_name: org.name,  // Changed from org.login to org.name
                            org_id: org.id,
                            commits_analyzed: 0,
                            last_sync: null,
                            active: false
                        });
                    });
                }
            });

            // Store the token data temporarily for the modal
            window.tempOrgData = {
                name: orgData.name,
                provider: orgData.provider,
                token: orgData.token,
                repositories: allRepos,
                organizations: result.data.orgs,
                integration_id: result.integration_id
            };

            // Close modal and open repository selection
            closeAddOrganizationModal();

            // Load repositories for selection (all checked by default)
            renderRepositoryListWithStatus(allRepos);
            openRepoSelectionModal();
        } else {
            throw new Error('No organizations found for this token');
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

    // Group repositories by organization
    const reposByOrg = {};
    repos.forEach(repo => {
        const orgName = repo.org_name || 'Unknown';
        if (!reposByOrg[orgName]) {
            reposByOrg[orgName] = [];
        }
        reposByOrg[orgName].push(repo);
    });

    // Render repositories grouped by organization
    Object.entries(reposByOrg).forEach(([orgName, orgRepos]) => {
        // Add organization header
        const orgHeader = document.createElement('div');
        orgHeader.style.cssText = 'padding: 8px 10px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 500; color: var(--accent-green);';
        orgHeader.innerHTML = `<span class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">business</span>${orgName} (${orgRepos.length} repositories)`;
        repoList.appendChild(orgHeader);

        // Add repositories for this organization
        orgRepos.forEach(repo => {
            const repoItem = document.createElement('div');
            repoItem.className = 'repo-item';
            const isPrivate = repo.private ? '<span class="material-icons" style="font-size: 14px; color: var(--warning-color); margin-left: 4px;" title="Private repository">lock</span>' : '';
            repoItem.innerHTML = `
                <input type="checkbox" id="repo-${repo.id}" value="${repo.id}" checked onchange="updateSelectedCount()">
                <label for="repo-${repo.id}" class="repo-item-info">
                    <div class="repo-name">${repo.name}${isPrivate}</div>
                    <div class="repo-description">${repo.description || 'No description'}</div>
                </label>
            `;
            repoList.appendChild(repoItem);
        });
    });

    updateSelectedCount();
}

// Filter repositories based on search and privacy settings
function filterRepositories() {
    const searchTerm = document.getElementById('repoSearchInput').value.toLowerCase();
    const showPrivateOnly = document.getElementById('showPrivateOnly').checked;
    const repoItems = document.querySelectorAll('.repo-item');

    repoItems.forEach(item => {
        const repoName = item.querySelector('.repo-name').textContent.toLowerCase();
        const repoDesc = item.querySelector('.repo-description').textContent.toLowerCase();
        const isPrivate = item.querySelector('.repo-name .material-icons') !== null; // Check if lock icon exists

        // Apply search filter
        const matchesSearch = repoName.includes(searchTerm) || repoDesc.includes(searchTerm);

        // Apply privacy filter
        const matchesPrivacy = !showPrivateOnly || isPrivate;

        if (matchesSearch && matchesPrivacy) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });

    // Also hide/show organization headers if all repos in that org are hidden
    const orgHeaders = document.querySelectorAll('#repoList > div:not(.repo-item)');
    orgHeaders.forEach(header => {
        let nextSibling = header.nextElementSibling;
        let hasVisibleRepo = false;

        while (nextSibling && nextSibling.classList.contains('repo-item')) {
            if (nextSibling.style.display !== 'none') {
                hasVisibleRepo = true;
                break;
            }
            nextSibling = nextSibling.nextElementSibling;
        }

        header.style.display = hasVisibleRepo ? 'block' : 'none';
    });

    updateSelectedCount();
}

// Update selected repository count
function updateSelectedCount() {
    const visibleItems = document.querySelectorAll('.repo-item:not([style*="display: none"])');
    const visibleBoxes = [];
    const checkedVisibleBoxes = [];

    visibleItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            visibleBoxes.push(checkbox);
            if (checkbox.checked) {
                checkedVisibleBoxes.push(checkbox);
            }
        }
    });

    const totalCount = visibleBoxes.length;
    const selectedCount = checkedVisibleBoxes.length;

    // Also show total repository count if filtering
    const allBoxes = document.querySelectorAll('#repoList input[type="checkbox"]');
    const filterActive = document.getElementById('showPrivateOnly').checked || document.getElementById('repoSearchInput').value.trim() !== '';

    if (filterActive && totalCount < allBoxes.length) {
        document.getElementById('selectedCount').textContent = `${selectedCount} of ${totalCount} visible repos selected (${allBoxes.length} total)`;
    } else {
        document.getElementById('selectedCount').textContent = `${selectedCount} of ${totalCount} repos selected`;
    }
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

    // Store selected repositories count for the next modal
    window.selectedRepositoriesCount = checkedBoxes.length;

    // Close repository selection modal and open organization activation modal
    closeRepoSelectionModal();
    openOrgActivationModal();
}

// Organization Activation Modal Functions
function openOrgActivationModal() {
    const tempData = window.tempOrgData;
    if (!tempData) {
        alert('Organization data not found');
        return;
    }

    // Update modal content
    document.getElementById('orgActivationName').textContent = tempData.name;
    document.getElementById('selectedRepoCount').textContent = window.selectedRepositoriesCount || 0;

    // Reset form state
    document.querySelectorAll('input[name="orgActivationMode"]').forEach(radio => {
        radio.checked = false;
    });
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('confirmOrgActivationBtn').disabled = true;

    // Show modal
    document.getElementById('orgActivationModal').classList.add('show');
}

function closeOrgActivationModal() {
    document.getElementById('orgActivationModal').classList.remove('show');
}

function selectOrgActivationOption(mode) {
    // Update radio button
    document.getElementById(mode === 'future' ? 'orgFutureOnly' : 'orgAllCommits').checked = true;

    // Update visual selection
    document.querySelectorAll('#orgActivationModal .option-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');

    // Enable confirm button
    document.getElementById('confirmOrgActivationBtn').disabled = false;
}

async function confirmOrgActivation() {
    const selectedMode = document.querySelector('input[name="orgActivationMode"]:checked')?.value;

    if (!selectedMode) {
        alert('Please select an activation mode');
        return;
    }

    try {
        // Show loading state
        const confirmBtn = document.getElementById('confirmOrgActivationBtn');
        const originalText = confirmBtn.textContent;
        confirmBtn.textContent = 'Creating...';
        confirmBtn.disabled = true;

        // Get the temporary organization data
        const tempData = window.tempOrgData;
        if (!tempData) {
            throw new Error('No organization data found');
        }

        // Build the organizations array for the API
        const organizationsToSend = [];

        // Group checked repositories by organization
        const checkedBoxes = document.querySelectorAll('#repoList input[type="checkbox"]:checked');
        const selectedRepoIds = Array.from(checkedBoxes).map(cb => cb.value);

        // Group selected repositories by organization
        const reposByOrg = {};
        tempData.repositories.forEach(repo => {
            if (selectedRepoIds.includes(repo.id.toString())) {
                const orgName = repo.org_name || 'Unknown';
                if (!reposByOrg[orgName]) {
                    reposByOrg[orgName] = [];
                }
                reposByOrg[orgName].push({
                    name: repo.name,
                });
            }
        });

        // Convert to the format expected by the API
        Object.entries(reposByOrg).forEach(([orgName, repos]) => {
            organizationsToSend.push({
                name: orgName,
                repositories: repos
            });
        });

        // Send the data to the /api/keys/selection endpoint
        const response = await fetch('/api/keys/selection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                integration_id: tempData.integration_id || window.integrationId,
                organizations: organizationsToSend,
                scan_filter: selectedMode
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create organizations and repositories');
        }

        const result = await response.json();

        if (result.success) {
            // Create mock organization for UI display (this will be replaced with real data in production)
            const allBoxes = document.querySelectorAll('#repoList input[type="checkbox"]');
            const checkedBoxes = document.querySelectorAll('#repoList input[type="checkbox"]:checked');
            const selectedRepos = [];
            const unselectedRepos = [];

            tempData.repositories.forEach(repo => {
                const checkbox = document.getElementById(`repo-${repo.id}`);
                if (checkbox && checkbox.checked) {
                    selectedRepos.push({
                        ...repo,
                        active: true,
                        last_sync: new Date().toISOString(),
                        scan_mode: selectedMode,
                        date_added: new Date().toISOString(),
                        added_by: 'admin@nuclea.com'
                    });
                } else {
                    unselectedRepos.push({
                        ...repo,
                        active: false,
                        last_sync: null,
                        scan_mode: null,
                        date_added: new Date().toISOString(),
                        added_by: 'admin@nuclea.com'
                    });
                }
            });

            // Add to organizations array (mock data for UI)
            const newOrg = {
                id: organizations.length + 1,
                name: tempData.name,
                provider: tempData.provider,
                token: tempData.token,
                webhook_active: true,
                date_added: new Date().toISOString(),
                added_by: 'admin@nuclea.com',
                default_scan_mode: selectedMode,
                repositories: [...selectedRepos, ...unselectedRepos]
            };

            organizations.push(newOrg);

            // Clean up temporary data
            delete window.tempOrgData;
            delete window.selectedRepositoriesCount;
            delete window.integrationId;

            closeOrgActivationModal();
            renderOrganizationsTable();
            updateStats();

            // Reset button state
            confirmBtn.textContent = originalText;
            confirmBtn.disabled = false;

            const activeCount = selectedRepos.length;
            const inactiveCount = unselectedRepos.length;
            const modeText = selectedMode === 'future' ? 'future commits only' : 'all commit history';
            alert(`Organization "${tempData.name}" created successfully!\n${activeCount} repositories active with ${modeText} analysis.\n${inactiveCount} repositories inactive.\n\nDatabase: ${result.total_organizations} organizations and ${result.total_repositories} repositories created.`);
        } else {
            throw new Error(result.message || 'Failed to create organization');
        }

    } catch (error) {
        console.error('Error creating organization:', error);
        alert(`Failed to create organization: ${error.message}`);

        // Reset button state
        const confirmBtn = document.getElementById('confirmOrgActivationBtn');
        confirmBtn.textContent = 'Create Organization';
        confirmBtn.disabled = false;
    }
}

// Organization delete functionality
let organizationToDelete = null;

function openDeleteOrganizationModal(orgId) {
    const org = organizations.find(o => o.id === orgId);
    if (!org) return;

    organizationToDelete = org;

    // Update modal content
    document.getElementById('deleteOrgName').textContent = org.name;
    document.getElementById('deleteOrgToken').textContent = getTokenSuffix(org.token);
    document.getElementById('confirmOrgName').textContent = org.name;
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('confirmDeleteBtn').disabled = true;

    // Remove previous input validation classes
    const input = document.getElementById('deleteConfirmInput');
    input.classList.remove('valid', 'invalid');

    // Show modal
    document.getElementById('deleteOrganizationModal').classList.add('show');
}

function closeDeleteOrganizationModal() {
    document.getElementById('deleteOrganizationModal').classList.remove('show');
    organizationToDelete = null;
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('confirmDeleteBtn').disabled = true;
}

function validateDeleteInput() {
    const input = document.getElementById('deleteConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const inputValue = input.value.trim();

    if (!organizationToDelete) return;

    const isValid = inputValue === organizationToDelete.name;

    // Update button state
    confirmBtn.disabled = !isValid;

    // Update input styling
    input.classList.remove('valid', 'invalid');
    if (inputValue.length > 0) {
        input.classList.add(isValid ? 'valid' : 'invalid');
    }
}

function confirmDeleteOrganization() {
    if (!organizationToDelete) return;

    const input = document.getElementById('deleteConfirmInput');
    if (input.value.trim() !== organizationToDelete.name) {
        alert('Organization name does not match');
        return;
    }

    // Remove organization from array
    const orgIndex = organizations.findIndex(o => o.id === organizationToDelete.id);
    if (orgIndex > -1) {
        organizations.splice(orgIndex, 1);
    }

    // Close modal
    closeDeleteOrganizationModal();

    // Update UI
    renderOrganizationsTable();
    updateStats();

    alert(`Organization "${organizationToDelete.name}" has been deleted successfully.`);
}


// Repository activation/deactivation modal functionality
let repositoryToToggle = null;

// Deactivate Repository Modal
function openDeactivateRepoModal(orgId, repoId) {
    const org = organizations.find(o => o.id === orgId);
    const repo = org.repositories.find(r => r.id === repoId);

    if (!repo) return;

    repositoryToToggle = { orgId, repoId, repo, org };

    // Update modal content
    document.getElementById('deactivateRepoName').textContent = repo.name;

    // Show modal
    document.getElementById('deactivateRepoModal').classList.add('show');
}

function closeDeactivateRepoModal() {
    document.getElementById('deactivateRepoModal').classList.remove('show');
    repositoryToToggle = null;
}

function confirmDeactivateRepository() {
    if (!repositoryToToggle) return;

    const { repo } = repositoryToToggle;

    // Deactivate repository
    repo.active = false;
    repo.last_sync = null;

    // Close modal
    closeDeactivateRepoModal();

    // Update UI
    renderOrganizationsTable();
    updateStats();

    alert(`Repository "${repo.name}" has been deactivated. Past analysis data remains available.`);
}

// Activate Repository Modal
function openActivateRepoModal(orgId, repoId) {
    const org = organizations.find(o => o.id === orgId);
    const repo = org.repositories.find(r => r.id === repoId);

    if (!repo) return;

    repositoryToToggle = { orgId, repoId, repo, org };

    // Update modal content
    document.getElementById('activateRepoName').textContent = repo.name;

    // Reset form state
    document.querySelectorAll('input[name="activationMode"]').forEach(radio => {
        radio.checked = false;
    });
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('confirmActivateBtn').disabled = true;

    // Show modal
    document.getElementById('activateRepoModal').classList.add('show');
}

function closeActivateRepoModal() {
    document.getElementById('activateRepoModal').classList.remove('show');
    repositoryToToggle = null;
}

function selectActivationOption(mode) {
    // Update radio button
    document.getElementById(mode === 'future' ? 'futureOnly' : 'allCommits').checked = true;

    // Update visual selection
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');

    // Enable confirm button
    document.getElementById('confirmActivateBtn').disabled = false;
}

function confirmActivateRepository() {
    if (!repositoryToToggle) return;

    const { repo } = repositoryToToggle;
    const selectedMode = document.querySelector('input[name="activationMode"]:checked')?.value;

    if (!selectedMode) {
        alert('Please select an activation mode');
        return;
    }

    // Activate repository
    repo.active = true;
    repo.last_sync = new Date().toISOString();
    repo.scan_mode = selectedMode; // Store the selected mode
    if (!repo.date_added) {
        repo.date_added = new Date().toISOString();
        repo.added_by = 'admin@nuclea.com';
    }

    // Close modal
    closeActivateRepoModal();

    // Update UI
    renderOrganizationsTable();
    updateStats();

    const modeText = selectedMode === 'future' ? 'future commits only' : 'all commit history';
    alert(`Repository "${repo.name}" has been activated with ${modeText} analysis mode.`);
}

// Start repository analysis
async function startRepositoryAnalysis(orgId, repoId) {
    const org = organizations.find(o => o.id === orgId);
    const repo = org?.repositories.find(r => r.id === repoId);
    
    if (!repo) {
        alert('Repository not found');
        return;
    }
    
    // Confirm action
    const confirmMessage = `Start analysis for repository "${repo.name}"?\n\nThis will analyze all commits in the repository.`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Find the button that was clicked and show loading state
        const button = event.target.closest('button');
        const originalContent = button.innerHTML;
        button.innerHTML = '<span class="material-icons">hourglass_empty</span> Starting...';
        button.disabled = true;
        
        // Call the start analysis endpoint
        const response = await fetch('/api/start-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                organization_id: orgId,
                repository_id: repoId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start analysis');
        }
        
        const result = await response.json();
        
        // Show success message
        alert(`Analysis started successfully for "${repo.name}"!\n\nThe commits will be analyzed in the background.`);
        
        // Restore button state
        button.innerHTML = originalContent;
        button.disabled = false;
        
    } catch (error) {
        console.error('Error starting analysis:', error);
        alert(`Failed to start analysis: ${error.message}`);
        
        // Restore button state on error
        const button = event.target.closest('button');
        if (button) {
            button.innerHTML = '<span class="material-icons">analytics</span> Analyze';
            button.disabled = false;
        }
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'deleteOrganizationModal') {
            closeDeleteOrganizationModal();
        } else if (event.target.id === 'deactivateRepoModal') {
            closeDeactivateRepoModal();
        } else if (event.target.id === 'activateRepoModal') {
            closeActivateRepoModal();
        } else if (event.target.id === 'orgActivationModal') {
            closeOrgActivationModal();
        } else {
            event.target.classList.remove('show');
        }
    }
};
