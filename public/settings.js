// Global variables
let githubConfig = null;
let commitStats = null;
let systemUsers = [];
let currentUserId = null;

// Check if user has permission to access settings
function checkSettingsAccess() {
    if (!isAdmin()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

// Load GitHub configuration
async function loadGithubConfig() {
    // Check permissions first
    if (!checkSettingsAccess()) {
        return;
    }
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
            <td><code>${user.github_username || 'Not Set'}</code></td>
            <td><span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span></td>
            <td><span class="status-badge status-${status}">${status.toUpperCase()}</span></td>
            <td>${createdDate}</td>
            <td>
                <div class="action-buttons">
                    <button class="view-details" onclick="editUser(${user.id})">Edit</button>
                    <button class="btn-danger-small" onclick="deleteUser(${user.id})" ${user.username === 'admin' ? 'disabled' : ''}>Delete</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Open user modal
function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const modalTitle = document.getElementById('modalTitle');
    const passwordField = document.getElementById('password');
    
    currentUserId = userId;
    form.reset();
    
    if (userId) {
        // Edit mode
        modalTitle.textContent = 'Edit User';
        passwordField.removeAttribute('required');
        passwordField.parentElement.querySelector('small').textContent = 'Leave empty to keep current password';
        
        const user = systemUsers.find(u => u.id === userId);
        if (user) {
            document.getElementById('userId').value = user.id;
            document.getElementById('username').value = user.username;
            document.getElementById('name').value = user.name;
            document.getElementById('role').value = user.role;
            document.getElementById('github_username').value = user.github_username || '';
        }
    } else {
        // Add mode
        modalTitle.textContent = 'Add New User';
        passwordField.setAttribute('required', '');
        passwordField.parentElement.querySelector('small').textContent = 'At least 6 characters (required for new users)';
    }
    
    modal.style.display = 'flex';
}

// Close user modal
function closeUserModal() {
    const modal = document.getElementById('userModal');
    modal.style.display = 'none';
    currentUserId = null;
}

// Save user (create or update)
async function saveUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const userId = formData.get('userId');
    
    const userData = {
        username: formData.get('username'),
        password: formData.get('password'),
        name: formData.get('name'),
        role: formData.get('role'),
        github_username: formData.get('github_username')
    };
    
    try {
        const url = userId ? `/api/system-users/${userId}` : '/api/system-users';
        const method = userId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to save user');
        }
        
        showNotification(userId ? 'User updated successfully' : 'User created successfully', 'success');
        closeUserModal();
        await loadSystemUsers();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Edit user
function editUser(userId) {
    openUserModal(userId);
}

// Delete user
function deleteUser(userId) {
    const user = systemUsers.find(u => u.id === userId);
    if (!user) return;
    
    const deleteModal = document.getElementById('deleteModal');
    const deleteUsername = document.getElementById('deleteUsername');
    
    deleteUsername.textContent = user.username;
    deleteModal.style.display = 'flex';
    currentUserId = userId;
}

// Close delete modal
function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'none';
    currentUserId = null;
}

// Confirm delete
async function confirmDelete() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(`/api/system-users/${currentUserId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete user');
        }
        
        showNotification('User deleted successfully', 'success');
        closeDeleteModal();
        await loadSystemUsers();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Setup user management event listeners
function setupUserManagementListeners() {
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            openUserModal();
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            if (event.target.id === 'userModal') {
                closeUserModal();
            } else if (event.target.id === 'deleteModal') {
                closeDeleteModal();
            }
        }
    });
}

// Make functions available globally
window.editUser = editUser;
window.deleteUser = deleteUser;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Auth check is handled by auth-utils.js
    // Only load settings if user has permission
    if (checkSettingsAccess()) {
        await loadGithubConfig();
        await loadCommitStats();
        await loadSystemUsers();
        setupEventListeners();
        setupUserManagementListeners();
    }
});