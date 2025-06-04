// Authentication utility functions

// Get stored token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Get stored user data
function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

// Get user role
function getUserRole() {
    const userData = getUserData();
    return userData ? userData.role : null;
}

// Check if user is admin
function isAdmin() {
    return getUserRole() === 'admin';
}

// Check if user has permission for a specific action
function hasPermission(action) {
    const role = getUserRole();
    const permissions = {
        admin: [
            'view_all_commits',
            'view_all_users',
            'view_all_projects',
            'manage_users',
            'manage_alerts',
            'manage_models',
            'manage_tools',
            'manage_settings',
            'view_analytics',
            'update_commit_status',
            'delete_commits'
        ],
        user: [
            'view_own_commits',
            'view_own_details',
            'view_assigned_projects',
            'view_daily_commits'
        ]
    };
    
    return permissions[role] && permissions[role].includes(action);
}

// Get auth headers for API requests
function getAuthHeaders() {
    const token = getAuthToken();
    if (token) {
        return {
            'Authorization': `Bearer ${token}`
        };
    }
    return {};
}

// Check if user is authenticated
async function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    
    try {
        const response = await fetch('/api/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = '/login';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/login';
        return false;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
}

// Add logout button to pages
function addLogoutButton() {
    const username = localStorage.getItem('username');
    const userData = getUserData();
    if (username && userData) {
        // Find sidebar header or create logout container
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader) {
            // Check if logout container already exists
            const existingContainer = document.querySelector('.logout-container');
            if (existingContainer) {
                return; // Already added
            }
            
            const logoutContainer = document.createElement('div');
            logoutContainer.className = 'logout-container';
            logoutContainer.style.cssText = `
                padding: 10px 20px;
                border-top: 1px solid var(--border-color);
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--bg-secondary);
            `;
            logoutContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: var(--text-primary); font-size: 0.9rem; font-weight: 500;">
                            ${userData.name || username}
                        </span>
                        <span style="color: var(--text-secondary); font-size: 0.8rem; display: block;">
                            ${userData.role === 'admin' ? 'Administrator' : 'User'}
                        </span>
                    </div>
                    <button onclick="logout()" style="
                        background: transparent;
                        border: 1px solid var(--border-color);
                        color: var(--text-primary);
                        padding: 4px 12px;
                        cursor: pointer;
                        font-size: 0.85rem;
                        transition: all 0.3s;
                    " onmouseover="this.style.borderColor='var(--accent-green)'; this.style.color='var(--accent-green)';" 
                       onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-primary)';">
                        Logout
                    </button>
                </div>
            `;
            
            // Add to sidebar
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.position = 'relative';
                sidebar.style.paddingBottom = '80px'; // Make room for logout container
                sidebar.appendChild(logoutContainer);
            }
        }
    }
}

// Hide restricted menu items based on user role
function updateNavigationVisibility() {
    const role = getUserRole();
    const userData = getUserData();
    
    // Add Profile link for all users
    if (userData && userData.username) {
        // Find the nav menu
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
            // Check if Profile link already exists and remove it to regenerate with correct URL
            const existingProfile = Array.from(navMenu.querySelectorAll('.nav-link')).find(
                link => link.textContent.trim() === 'Profile'
            );
            
            if (existingProfile) {
                existingProfile.parentElement.remove();
            }
            
            // Always create a fresh Profile link to ensure correct URL
            // Create Profile link
            const profileLi = document.createElement('li');
            const profileLink = document.createElement('a');
            profileLink.href = `/user-details.html?user=${encodeURIComponent(userData.username)}`;
            profileLink.className = 'nav-link';
            profileLink.textContent = 'Profile';
                
                // Check if current page is user-details for this user
                if (window.location.pathname === '/user-details.html' || 
                    window.location.pathname === '/user-details') {
                    const urlParams = new URLSearchParams(window.location.search);
                    const pageUser = urlParams.get('user');
                    if (pageUser === userData.username) {
                        profileLink.classList.add('active');
                    }
                }
                
                profileLi.appendChild(profileLink);
                
                // Insert Profile link after Commits (at position 2)
                const commitLink = navMenu.querySelector('a[href="/index.html"]');
                if (commitLink && commitLink.parentElement) {
                    commitLink.parentElement.insertAdjacentElement('afterend', profileLi);
                }
            }
        }
    }
    
    if (role !== 'user') return; // Only hide items for non-admin users
    
    // Define restricted pages for user role (now includes 'users')
    const restrictedPages = ['alerts', 'models', 'tools', 'settings', 'analytics', 'users'];
    
    // Hide restricted navigation items
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
            const pageName = href.replace('/', '').replace('.html', '');
            if (restrictedPages.includes(pageName)) {
                // Hide the parent li element
                const parentLi = link.parentElement;
                if (parentLi && parentLi.tagName === 'LI') {
                    parentLi.style.display = 'none';
                }
            }
        }
    });
}

// Check if current page is accessible for user role
function checkPageAccess() {
    const currentPath = window.location.pathname.replace('/', '').replace('.html', '');
    const role = getUserRole();
    
    // Define pages that require admin role (now includes 'users')
    const adminOnlyPages = ['alerts', 'models', 'tools', 'settings', 'analytics', 'users'];
    
    // Redirect non-admin users trying to access admin-only pages
    if (role === 'user' && adminOnlyPages.includes(currentPath)) {
        window.location.href = '/index.html';
        return false;
    }
    
    return true;
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Skip auth check on login page
    if (window.location.pathname === '/login' || window.location.pathname === '/login.html') {
        return;
    }
    
    // Only check auth on protected pages
    if (window.location.pathname !== '/login.js' && window.location.pathname !== '/styles.css') {
        await checkAuth();
        if (checkPageAccess()) {
            addLogoutButton();
            updateNavigationVisibility();
        }
    }
});