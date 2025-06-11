// Tools Management
let tools = [];
let filteredTools = [];
let users = [];
let exchangeRate = 17.5;

// Check if user has access to tools page
function checkToolsAccess() {
    const userData = getUserData();
    if (!userData || !isAdmin()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    if (checkToolsAccess()) {
        loadTools();
        loadUsers();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('toolsSearch').addEventListener('input', filterTools);
    
    // Category filter
    document.getElementById('categoryFilter').addEventListener('change', filterTools);
    
    // Add tool button
    document.getElementById('addToolBtn').addEventListener('click', showAddToolModal);
    
    // Modal controls
    document.getElementById('closeModal').addEventListener('click', hideModal);
    document.getElementById('cancelBtn').addEventListener('click', hideModal);
    
    // Form submission
    document.getElementById('toolForm').addEventListener('submit', handleToolSubmit);
    
    // Cost calculator controls
    document.getElementById('userSelect').addEventListener('change', calculateUserToolsCost);
    document.getElementById('updateRateBtn').addEventListener('click', updateExchangeRate);
    document.getElementById('exchangeRate').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            updateExchangeRate();
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('toolModal');
        if (event.target === modal) {
            hideModal();
        }
    });
}

// Load tools from JSON file and localStorage for user customizations
async function loadTools() {
    try {
        console.log('Loading tools from API...');
        // Load tools from SQLite database via API
        const response = await fetch('/api/tools', {
            headers: getAuthHeaders()
        });
        
        console.log('Tools API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error('Failed to fetch tools: ' + errorText);
        }
        
        const data = await response.json();
        console.log('Tools API response data:', data);
        
        tools = data.tools || [];
        
        // Also store the raw database tools for ID mapping
        window.dbTools = data.tools || [];
        
        filteredTools = [...tools];
        renderTools();
        
        console.log(`Loaded ${tools.length} tools from database`);
        console.log('Tools loaded:', tools);
    } catch (error) {
        console.error('Error loading tools:', error);
        // Fallback to empty array if API loading fails
        tools = [];
        filteredTools = [];
        renderTools();
    }
}

// Also export function to get all available tools for other pages
window.getAvailableTools = async function() {
    try {
        const response = await fetch('/api/tools', {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        return data.tools || [];
    } catch (error) {
        console.error('Error loading tools data:', error);
        return [];
    }
}

// No longer needed - tools are stored in SQLite database

// Generate unique ID
function generateId() {
    return 'tool_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Filter tools based on search and category
function filterTools() {
    const searchTerm = document.getElementById('toolsSearch').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    filteredTools = tools.filter(tool => {
        const matchesSearch = !searchTerm || 
            tool.name.toLowerCase().includes(searchTerm) ||
            tool.description.toLowerCase().includes(searchTerm) ||
            tool.category.toLowerCase().includes(searchTerm);
            
        const matchesCategory = !categoryFilter || tool.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    renderTools();
}

// Render tools table
function renderTools() {
    const tbody = document.getElementById('toolsBody');
    tbody.innerHTML = '';
    
    if (filteredTools.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-message">No tools found</td>
            </tr>
        `;
        return;
    }
    
    filteredTools.forEach(tool => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="tool-image">
                ${tool.image ? 
                    `<img src="${tool.image}" alt="${tool.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2240%22%3E?%3C/text%3E%3C/svg%3E'">` : 
                    '<div class="no-image">No Image</div>'
                }
            </td>
            <td class="tool-name">${escapeHtml(tool.name)}</td>
            <td><span class="category-badge">${escapeHtml(tool.category)}</span></td>
            <td class="tool-description">${escapeHtml(tool.description)}</td>
            <td class="tool-price">${escapeHtml(tool.price || 'N/A')}</td>
            <td class="tool-website">
                ${tool.website ? 
                    `<a href="${tool.website}" target="_blank" rel="noopener noreferrer" class="github-link">Visit Site</a>` : 
                    '<span style="color: var(--text-secondary)">-</span>'
                }
            </td>
            <td class="tool-actions">
                <button class="view-details" onclick="editTool('${tool.id}')">Edit</button>
                <button class="btn-danger-small" onclick="deleteTool('${tool.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Show add tool modal
function showAddToolModal() {
    document.getElementById('modalTitle').textContent = 'Add New Tool';
    document.getElementById('toolForm').reset();
    document.getElementById('toolId').value = '';
    document.getElementById('toolModal').style.display = 'block';
}

// Show edit tool modal
function editTool(toolId) {
    console.log('Editing tool with ID:', toolId);
    const tool = tools.find(t => t.id === toolId);
    console.log('Found tool:', tool);
    
    if (!tool) {
        console.error('Tool not found with ID:', toolId);
        alert('Tool not found. Please refresh the page and try again.');
        return;
    }
    
    document.getElementById('modalTitle').textContent = 'Edit Tool';
    document.getElementById('toolId').value = tool.id;
    document.getElementById('toolImage').value = tool.image || '';
    document.getElementById('toolName').value = tool.name;
    document.getElementById('toolCategory').value = tool.category;
    document.getElementById('toolDescription').value = tool.description;
    document.getElementById('toolPrice').value = tool.price || '';
    document.getElementById('toolWebsite').value = tool.website || '';
    
    document.getElementById('toolModal').style.display = 'block';
}

// Hide modal
function hideModal() {
    document.getElementById('toolModal').style.display = 'none';
    document.getElementById('toolForm').reset();
}

// Handle tool form submission
async function handleToolSubmit(e) {
    e.preventDefault();
    
    const toolId = document.getElementById('toolId').value;
    const toolData = {
        id: toolId || generateId(),
        image: document.getElementById('toolImage').value.trim(),
        name: document.getElementById('toolName').value.trim(),
        category: document.getElementById('toolCategory').value,
        description: document.getElementById('toolDescription').value.trim(),
        price: document.getElementById('toolPrice').value.trim(),
        website: document.getElementById('toolWebsite').value.trim()
    };
    
    // Parse cost per month from price
    const priceStr = toolData.price.toLowerCase();
    let costPerMonth = null;
    if (priceStr.includes('/month')) {
        const match = priceStr.match(/\$?(\d+(?:\.\d{2})?)/);
        if (match) {
            costPerMonth = parseFloat(match[1]);
        }
    }
    toolData.costPerMonth = costPerMonth;
    
    try {
        console.log('Saving tool data:', toolData);
        
        if (toolId) {
            // Update existing tool
            console.log('Updating existing tool with ID:', toolId);
            const existingTool = tools.find(t => t.id === toolId);
            console.log('Found existing tool:', existingTool);
            
            if (existingTool) {
                console.log('Using database ID for update:', existingTool.dbId);
                
                if (existingTool.dbId) {
                    console.log('Sending PUT request to update tool...');
                    const updateResponse = await fetch(`/api/tools/${existingTool.dbId}`, {
                        method: 'PUT',
                        headers: {
                            ...getAuthHeaders(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(toolData)
                    });
                    
                    console.log('Update response status:', updateResponse.status);
                    
                    if (!updateResponse.ok) {
                        const errorText = await updateResponse.text();
                        console.error('Update error response:', errorText);
                        throw new Error('Failed to update tool: ' + errorText);
                    }
                    
                    console.log('Tool updated successfully');
                } else {
                    throw new Error('Tool database ID not found');
                }
            } else {
                throw new Error('Tool not found in local tools array');
            }
        } else {
            // Add new tool
            console.log('Creating new tool...');
            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(toolData)
            });
            
            console.log('Create response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Create error response:', errorText);
                throw new Error('Failed to create tool: ' + errorText);
            }
            
            console.log('Tool created successfully');
        }
        
        // Reload tools from database
        console.log('Reloading tools...');
        await loadTools();
        hideModal();
        console.log('Tool save process completed successfully');
        
    } catch (error) {
        console.error('Error saving tool:', error);
        console.error('Full error details:', error.message, error.stack);
        alert('Failed to save tool: ' + error.message);
    }
}

// Delete tool
async function deleteTool(toolId) {
    console.log('Deleting tool with ID:', toolId);
    
    if (confirm('Are you sure you want to delete this tool?')) {
        try {
            const tool = tools.find(t => t.id === toolId);
            console.log('Found tool for deletion:', tool);
            
            if (tool && tool.dbId) {
                console.log('Using database ID for deletion:', tool.dbId);
                
                const deleteResponse = await fetch(`/api/tools/${tool.dbId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                console.log('Delete response status:', deleteResponse.status);
                
                if (!deleteResponse.ok) {
                    const errorText = await deleteResponse.text();
                    console.error('Delete response error:', errorText);
                    throw new Error('Failed to delete tool: ' + errorText);
                }
                
                console.log('Tool deleted successfully');
                // Reload tools from database
                await loadTools();
            } else {
                console.error('Tool not found or missing database ID');
                alert('Tool not found. Please refresh the page and try again.');
            }
        } catch (error) {
            console.error('Error deleting tool:', error);
            alert('Failed to delete tool: ' + error.message);
        }
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Reload tools from database (can be called from console)
window.reloadTools = async function() {
    await loadTools();
    console.log('Tools reloaded from database');
};

// Make edit and delete functions globally accessible
window.editTool = editTool;
window.deleteTool = deleteTool;

// Load users for the cost calculator
async function loadUsers() {
    try {
        const response = await fetch('/api/users/all/details', {
            headers: getAuthHeaders()
        });
        const allUserDetails = await response.json();
        
        // Extract user names from the user details object
        users = Object.keys(allUserDetails).map(username => ({
            name: username
        }));
        
        // Populate user select dropdown
        const userSelect = document.getElementById('userSelect');
        userSelect.innerHTML = '<option value="">Select a user...</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Parse price string to get numeric value
function parsePriceToNumber(priceString) {
    if (!priceString || priceString.toLowerCase() === 'free') {
        return 0;
    }
    
    // Remove currency symbols and convert to lowercase
    const cleanPrice = priceString.replace(/[$,]/g, '').toLowerCase();
    
    // Extract numeric value
    const match = cleanPrice.match(/(\d+\.?\d*)/);
    if (match) {
        return parseFloat(match[1]);
    }
    
    return 0;
}

// Update exchange rate
function updateExchangeRate() {
    const rateInput = document.getElementById('exchangeRate');
    const newRate = parseFloat(rateInput.value);
    
    if (isNaN(newRate) || newRate <= 0) {
        alert('Please enter a valid exchange rate');
        rateInput.value = exchangeRate;
        return;
    }
    
    exchangeRate = newRate;
    
    // Recalculate if a user is selected
    const selectedUser = document.getElementById('userSelect').value;
    if (selectedUser) {
        calculateUserToolsCost();
    }
}

// Calculate tools cost for selected user
async function calculateUserToolsCost() {
    const selectedUser = document.getElementById('userSelect').value;
    const costTableWrapper = document.getElementById('costTableWrapper');
    const noUserSelected = document.getElementById('noUserSelected');
    const costTableBody = document.getElementById('costTableBody');
    
    if (!selectedUser) {
        costTableWrapper.style.display = 'none';
        noUserSelected.style.display = 'block';
        return;
    }
    
    try {
        // Fetch user details to get their tools
        const response = await fetch(`/api/users/${selectedUser}/details`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        
        const userDetails = await response.json();
        const userTools = userDetails.tools || [];
        
        // Show cost table
        costTableWrapper.style.display = 'block';
        noUserSelected.style.display = 'none';
        
        // Clear existing rows
        costTableBody.innerHTML = '';
        
        let totalUSD = 0;
        
        // Calculate costs for each tool
        userTools.forEach(userTool => {
            // Handle both old format (string) and new format (object)
            const toolId = typeof userTool === 'string' ? userTool : userTool.toolId;
            const tool = tools.find(t => t.id === toolId);
            if (tool) {
                const row = document.createElement('tr');
                const costUSD = parsePriceToNumber(tool.price);
                const costMXN = costUSD * exchangeRate;
                
                totalUSD += costUSD;
                
                row.innerHTML = `
                    <td>${escapeHtml(tool.name)}</td>
                    <td>${costUSD === 0 ? 'Free' : '$' + costUSD.toFixed(2)}</td>
                    <td>${costUSD === 0 ? 'Free' : '$' + costMXN.toFixed(2) + ' MX'}</td>
                `;
                
                costTableBody.appendChild(row);
            }
        });
        
        // Update totals
        const totalMXN = totalUSD * exchangeRate;
        document.getElementById('totalUSD').innerHTML = '<strong>$' + totalUSD.toFixed(2) + '</strong>';
        document.getElementById('totalMXN').innerHTML = '<strong>$' + totalMXN.toFixed(2) + ' MX</strong>';
        
        // Show message if no tools
        if (userTools.length === 0) {
            costTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-message">This user has no tools selected</td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error('Error calculating tools cost:', error);
        alert('Error loading user tools. Please try again.');
    }
}