// Organizations Management
let allOrganizations = [];
let currentEditingOrgId = null;

// Initialize page
async function init() {
    try {
        // Check authentication
        const isAuth = await checkAuth();
        if (!isAuth) return;

        // Check if user is admin
        const userData = getUserData();
        if (userData && userData.role === 'admin') {
            document.getElementById('addOrganizationBtn').style.display = 'flex';
        }

        // Load organizations
        await loadOrganizations();

        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing organizations page:', error);
    }
}

// Load organizations from API
async function loadOrganizations() {
    try {
        const response = await fetch('/api/organizations', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch organizations');
        }

        allOrganizations = await response.json();
        updateStats();
        renderOrganizationsTable();
    } catch (error) {
        console.error('Error loading organizations:', error);
        showError('Failed to load organizations');
    }
}

// Update statistics
function updateStats() {
    let totalMembers = 0;
    let totalProjects = new Set();
    let totalCommits = 0;

    allOrganizations.forEach(org => {
        if (org.stats) {
            totalMembers += org.stats.totalMembers || 0;
            totalCommits += org.stats.totalCommits || 0;
        }
    });

    document.getElementById('totalOrganizations').textContent = allOrganizations.length;
    document.getElementById('totalMembers').textContent = totalMembers;
    document.getElementById('totalProjects').textContent = totalProjects.size;
    document.getElementById('totalOrgCommits').textContent = totalCommits;
}

// Render organizations table
function renderOrganizationsTable() {
    const tbody = document.getElementById('organizationsBody');
    tbody.innerHTML = '';

    if (allOrganizations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No organizations found</td></tr>';
        return;
    }

    allOrganizations.forEach(org => {
        const row = document.createElement('tr');

        const stats = org.stats || {};
        const avgQuality = stats.averageQuality ? stats.averageQuality.toFixed(1) : '-';
        const statusClass = org.is_active ? 'status-active' : 'status-inactive';
        const statusText = org.is_active ? 'Active' : 'Inactive';

        row.innerHTML = `
            <td>${org.name}</td>
            <td>${org.display_name || org.name}</td>
            <td>${stats.totalMembers || 0}</td>
            <td>${stats.totalProjects || 0}</td>
            <td>${stats.totalCommits || 0}</td>
            <td><span class="badge quality-${Math.floor(stats.averageQuality || 0)}">${avgQuality}</span></td>
            <td class="positive">+${stats.totalLinesAdded || 0}</td>
            <td class="negative">-${stats.totalLinesDeleted || 0}</td>
            <td>${org.industry || '-'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="view-details" onclick="viewOrganizationDetails('${org.slug || org.id}')">
                    Details
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// View organization details
function viewOrganizationDetails(identifier) {
    window.location.href = `/organization-details.html?org=${identifier}`;
}

// Edit organization
async function editOrganization(orgId) {
    const userData = getUserData();
    if (!userData || userData.role !== 'admin') {
        showError('Only administrators can edit organizations');
        return;
    }

    const org = allOrganizations.find(o => o.id === orgId);
    if (!org) return;

    currentEditingOrgId = orgId;
    document.getElementById('modalTitle').textContent = 'Edit Organization';
    
    // Populate form
    document.getElementById('orgName').value = org.name;
    document.getElementById('orgDisplayName').value = org.display_name || '';
    document.getElementById('orgSlug').value = org.slug || '';
    document.getElementById('orgDescription').value = org.description || '';
    document.getElementById('orgWebsite').value = org.website || '';
    document.getElementById('orgGithubUrl').value = org.github_url || '';
    document.getElementById('orgIndustry').value = org.industry || '';
    document.getElementById('orgLocation').value = org.location || '';

    // Show modal
    document.getElementById('organizationModal').style.display = 'block';
}

// Delete organization
async function deleteOrganization(orgId) {
    const userData = getUserData();
    if (!userData || userData.role !== 'admin') {
        showError('Only administrators can delete organizations');
        return;
    }

    const org = allOrganizations.find(o => o.id === orgId);
    if (!org) return;

    if (confirm(`Are you sure you want to delete the organization "${org.name}"?`)) {
        try {
            const response = await fetch(`/api/organizations/${orgId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to delete organization');
            }

            await loadOrganizations();
            showSuccess('Organization deleted successfully');
        } catch (error) {
            console.error('Error deleting organization:', error);
            showError('Failed to delete organization');
        }
    }
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('organizationsSearch').addEventListener('input', (e) => {
        filterOrganizations(e.target.value);
    });

    // Add organization button
    document.getElementById('addOrganizationBtn').addEventListener('click', () => {
        currentEditingOrgId = null;
        document.getElementById('modalTitle').textContent = 'Add Organization';
        document.getElementById('organizationForm').reset();
        document.getElementById('organizationModal').style.display = 'block';
    });

    // Form submission
    document.getElementById('organizationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOrganization();
    });

    // Modal close button
    document.querySelector('.modal .close').addEventListener('click', closeOrganizationModal);

    // Auto-generate slug
    document.getElementById('orgName').addEventListener('input', (e) => {
        if (!currentEditingOrgId) {
            const slug = e.target.value.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            document.getElementById('orgSlug').value = slug;
        }
    });
}

// Save organization
async function saveOrganization() {
    const orgData = {
        name: document.getElementById('orgName').value,
        display_name: document.getElementById('orgDisplayName').value || document.getElementById('orgName').value,
        slug: document.getElementById('orgSlug').value,
        description: document.getElementById('orgDescription').value,
        website: document.getElementById('orgWebsite').value,
        github_url: document.getElementById('orgGithubUrl').value,
        industry: document.getElementById('orgIndustry').value,
        location: document.getElementById('orgLocation').value
    };

    try {
        const url = currentEditingOrgId 
            ? `/api/organizations/${currentEditingOrgId}`
            : '/api/organizations';
        
        const method = currentEditingOrgId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orgData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save organization');
        }

        await loadOrganizations();
        closeOrganizationModal();
        showSuccess(`Organization ${currentEditingOrgId ? 'updated' : 'created'} successfully`);
    } catch (error) {
        console.error('Error saving organization:', error);
        showError(error.message);
    }
}

// Filter organizations
function filterOrganizations(searchTerm) {
    const tbody = document.getElementById('organizationsBody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(searchTerm.toLowerCase());
        row.style.display = matches ? '' : 'none';
    });
}

// Close organization modal
function closeOrganizationModal() {
    document.getElementById('organizationModal').style.display = 'none';
    currentEditingOrgId = null;
}

// Show error message
function showError(message) {
    alert('Error: ' + message);
}

// Show success message
function showSuccess(message) {
    alert(message);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('organizationModal');
    if (event.target === modal) {
        closeOrganizationModal();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);