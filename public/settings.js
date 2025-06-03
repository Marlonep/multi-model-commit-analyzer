// Global variables
let githubConfig = null;
let commitStats = null;
let systemUsers = [];

// Load GitHub configuration
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

// Load commit statistics
async function loadCommitStats() {
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
        commitStats = {
            totalCommits: commits.length,
            lastAnalyzed: commits.length > 0 ? new Date(commits[0].analyzedAt || commits[0].timestamp) : null
        };
        
        updateStats();
    } catch (error) {
        console.error('Error loading commit stats:', error);
    }
}

// Update statistics display
function updateStats() {
    // Update commit count
    const commitCountElements = document.querySelectorAll('.stat-value');
    if (commitCountElements[1]) {
        commitCountElements[1].textContent = commitStats.totalCommits;
    }
    
    // Update organization name if needed
    const orgNameElement = document.querySelector('.org-name');
    if (orgNameElement && githubConfig) {
        orgNameElement.textContent = githubConfig.username;
    }
    
    // Update repository name
    const repoNameElement = document.querySelector('.repo-name');
    if (repoNameElement && githubConfig) {
        repoNameElement.textContent = githubConfig.repository;
    }
}

// Handle button clicks
function setupEventListeners() {
    // Configure button for GitHub
    const configureBtn = document.querySelector('.integration-card.active .btn-secondary');
    if (configureBtn) {
        configureBtn.addEventListener('click', () => {
            alert('GitHub configuration will be available in the next update.');
        });
    }
    
    // View Details button for repository
    const viewDetailsBtn = document.querySelector('.btn-small');
    if (viewDetailsBtn) {
        viewDetailsBtn.addEventListener('click', () => {
            window.location.href = `/project-details.html?project=${encodeURIComponent(githubConfig.repository)}`;
        });
    }
    
    // Configuration select handlers
    const configSelects = document.querySelectorAll('.config-select');
    configSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            // Save configuration (would normally make an API call here)
            console.log(`Configuration changed: ${e.target.previousElementSibling.textContent} = ${e.target.value}`);
        });
    });
}

// Load system users
async function loadSystemUsers() {
    try {
        const response = await fetch('/api/system-users', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load users');
        }
        
        systemUsers = await response.json();
        displaySystemUsers();
    } catch (error) {
        console.error('Error loading system users:', error);
        // Display hardcoded admin user as fallback
        systemUsers = [
            {
                id: 1,
                username: "admin",
                password: "$2b$10$TKR0lofZVaffqgKsBoL.KOku95vAcEy78amOS2qK.HjYzOYQIS0qG",
                role: "admin",
                name: "Administrator",
                createdAt: "2025-01-01T00:00:00Z",
                status: "active"
            }
        ];
        displaySystemUsers();
    }
}

// Display system users in table
function displaySystemUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    systemUsers.forEach(user => {
        const row = document.createElement('tr');
        const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        const status = user.status || 'active';
        
        row.innerHTML = `
            <td>${user.id}</td>
            <td><code>${user.username}</code></td>
            <td>${user.name}</td>
            <td><span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span></td>
            <td><span class="status-badge status-${status}">${status.toUpperCase()}</span></td>
            <td>${createdDate}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-small secondary" onclick="editUser(${user.id})">Edit</button>
                    <button class="btn-small danger" onclick="deleteUser(${user.id})" ${user.username === 'admin' ? 'disabled' : ''}>Delete</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Edit user
function editUser(userId) {
    const user = systemUsers.find(u => u.id === userId);
    if (!user) return;
    
    alert(`Edit functionality for ${user.username} will be available in the next update.`);
}

// Delete user
function deleteUser(userId) {
    const user = systemUsers.find(u => u.id === userId);
    if (!user) return;
    
    if (user.username === 'admin') {
        alert('Cannot delete the admin user.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
        alert('Delete functionality will be available in the next update.');
    }
}

// Setup user management event listeners
function setupUserManagementListeners() {
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            alert('Add user functionality will be available in the next update.');
        });
    }
}

// Make functions available globally
window.editUser = editUser;
window.deleteUser = deleteUser;

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadGithubConfig();
    await loadCommitStats();
    await loadSystemUsers();
    setupEventListeners();
    setupUserManagementListeners();
});