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
    
    console.log('addLogoutButton called:', { username, userData });
    
    if (username || userData) {
        // Check if logout button already exists
        const existingLogout = document.querySelector('.logout-nav-item');
        if (existingLogout) {
            console.log('Logout button already exists, skipping');
            return; // Already added
        }
        
        // Find the nav menu to add logout as a nav item
        const navMenu = document.querySelector('.nav-menu');
        console.log('Nav menu found:', navMenu);
        
        if (navMenu) {
            // Create logout nav item that matches the existing nav items
            const logoutLi = document.createElement('li');
            logoutLi.className = 'logout-nav-item';
            
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'nav-link logout-link';
            logoutLink.onclick = function(e) {
                e.preventDefault();
                logout();
            };
            
            // Build user display name and role
            const displayName = userData ? userData.name : username;
            const userRole = userData ? (userData.role === 'admin' ? 'Admin' : 'User') : 'User';
            
            logoutLink.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <span style="margin-right: 8px; font-size: 1.1rem;">👤</span>
                    <span style="font-size: 0.95rem; font-weight: 500;">Logout</span>
                </div>
                <span style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.2;">
                    ${displayName || username} (${userRole})
                </span>
            `;
            
            logoutLi.appendChild(logoutLink);
            
            // Add to the end of nav menu
            navMenu.appendChild(logoutLi);
            console.log('Logout button added to nav menu');
            
            // Add custom styles for the logout nav item
            if (!document.getElementById('logout-nav-styles')) {
                const style = document.createElement('style');
                style.id = 'logout-nav-styles';
                style.textContent = `
                    .logout-nav-item {
                        margin-top: auto;
                        border-top: 1px solid var(--border-color);
                        padding-top: 10px;
                    }
                    
                    .logout-link {
                        display: flex !important;
                        flex-direction: column;
                        align-items: flex-start !important;
                        padding: 12px 20px !important;
                        position: relative;
                        border-radius: 0 !important;
                        transition: all 0.3s;
                    }
                    
                    .logout-link:hover {
                        background: var(--hover-bg, rgba(255, 255, 255, 0.1)) !important;
                        color: var(--accent-green) !important;
                    }
                    
                    .logout-link:hover span {
                        color: var(--accent-green) !important;
                    }
                    
                    /* Ensure sidebar has enough space and proper layout */
                    .sidebar {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .nav-menu {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                    }
                `;
                document.head.appendChild(style);
                console.log('Logout button styles added');
            }
        } else {
            console.error('Nav menu not found! Cannot add logout button');
        }
    } else {
        console.log('No user data found, not adding logout button');
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

// Make functions globally available
window.logout = logout;
window.addLogoutButton = addLogoutButton;

// Force add logout button (for debugging)
window.forceAddLogoutButton = function() {
    console.log('Force adding logout button...');
    
    // Set fake data if none exists
    if (!localStorage.getItem('username')) {
        localStorage.setItem('username', 'admin');
    }
    if (!localStorage.getItem('userData')) {
        localStorage.setItem('userData', JSON.stringify({
            username: 'admin',
            name: 'Administrator', 
            role: 'admin'
        }));
    }
    
    // Remove existing logout button
    const existing = document.querySelector('.logout-nav-item');
    if (existing) {
        existing.remove();
    }
    
    // Call addLogoutButton
    addLogoutButton();
};

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