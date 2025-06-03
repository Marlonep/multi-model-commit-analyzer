// Global variables
let githubConfig = null;
let commitStats = null;

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

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadGithubConfig();
    await loadCommitStats();
    setupEventListeners();
});