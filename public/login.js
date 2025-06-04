document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');
    
    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }
    
    // Function to handle login
    async function handleLogin(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log('Form submitted');
        
        // Clear any previous errors
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
        
        // Get form data
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        console.log('Attempting login with username:', username);
        
        // Disable button and show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        
        try {
            console.log('Sending login request...');
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (response.ok) {
                // Login successful
                console.log('Login successful, storing token...');
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                
                // Store user data including role
                const userData = {
                    username: data.username,
                    name: data.name,
                    role: data.role
                };
                localStorage.setItem('userData', JSON.stringify(userData));
                
                // Redirect based on user role
                console.log('User role:', data.role);
                if (data.role === 'user') {
                    // Redirect regular users to commits page
                    window.location.href = '/index.html';
                } else {
                    // Redirect admins to analytics page
                    window.location.href = '/analytics.html';
                }
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
        
        return false; // Prevent form submission
    }
    
    // Add event listeners
    loginForm.addEventListener('submit', handleLogin);
    loginButton.addEventListener('click', function(e) {
        console.log('Button clicked');
        e.preventDefault();
        handleLogin(e);
    });
    
    // Don't check if already logged in to prevent loops
});