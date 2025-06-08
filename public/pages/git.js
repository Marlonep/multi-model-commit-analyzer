// Global variables
let githubConfig = null;
let commitStats = null;

// Check if user has permission to access git integrations
function checkGitAccess() {
    if (!isAdmin()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

// Load GitHub configuration
async function loadGithubConfig() {
    // Check permissions first
    if (!checkGitAccess()) {
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
            username: 'Nuclea-Solutions',
            repository: 'multi-model-commit-analyzer',
            baseUrl: 'https://github.com/Nuclea-Solutions/multi-model-commit-analyzer'
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
            window.location.href = `/pages/project-details.html?project=${encodeURIComponent(githubConfig.repository)}`;
        });
    }
    
    // Add Repository button
    const addRepoBtn = document.getElementById('addRepoBtn');
    if (addRepoBtn) {
        addRepoBtn.addEventListener('click', () => {
            alert('Add Repository functionality will be available in the next update.');
        });
    }
    
    // Configure sync frequency buttons
    const configureButtons = document.querySelectorAll('.sync-card .btn-small');
    configureButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Sync configuration will be available in the next update.');
        });
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

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Auth check is handled by auth-utils.js
    // Only load git settings if user has permission
    if (checkGitAccess()) {
        await loadGithubConfig();
        await loadCommitStats();
        setupEventListeners();
    }
});