document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear any previous errors
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
        
        // Get form data
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Disable button and show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Login successful
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                
                // Redirect to main page
                window.location.href = '/';
            } else {
                // Show error message
                errorMessage.textContent = data.error || 'Login failed';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            errorMessage.textContent = 'Network error. Please try again.';
            errorMessage.style.display = 'block';
        } finally {
            // Re-enable button
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
    
    // Check if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        // Verify token is still valid
        fetch('/api/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token is valid, redirect to main page
                window.location.href = '/';
            } else {
                // Token is invalid, clear it
                localStorage.removeItem('token');
                localStorage.removeItem('username');
            }
        })
        .catch(() => {
            // Error verifying token, clear it
            localStorage.removeItem('token');
            localStorage.removeItem('username');
        });
    }
});