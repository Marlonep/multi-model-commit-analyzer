// Authentication utility functions

// Get stored token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Get auth headers for API requests
function getAuthHeaders() {
    const token = getAuthToken();
    if (token) {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }
    return {
        'Content-Type': 'application/json'
    };
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
        window.location.href = '/login';
        return false;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
}

// Add logout button to pages
function addLogoutButton() {
    const username = localStorage.getItem('username');
    if (username) {
        // Find sidebar header or create logout container
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader) {
            const logoutContainer = document.createElement('div');
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
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${username}
                    </span>
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
                sidebar.appendChild(logoutContainer);
            }
        }
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Skip auth check on login page
    if (window.location.pathname === '/login' || window.location.pathname === '/login.html') {
        return;
    }
    
    await checkAuth();
    addLogoutButton();
});