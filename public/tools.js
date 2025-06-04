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
        // Load tools from SQLite database via API
        const response = await fetch('/api/tools', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch tools');
        }
        
        const data = await response.json();
        tools = data.tools || [];
        
        filteredTools = [...tools];
        renderTools();
        
        console.log(`Loaded ${tools.length} tools from database`);
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
                    `<a href="${tool.website}" target="_blank" rel="noopener noreferrer">Visit Site</a>` : 
                    'N/A'
                }
            </td>
            <td class="tool-actions">
                <button class="btn-small btn-edit" onclick="editTool('${tool.id}')">Edit</button>
                <button class="btn-small btn-delete" onclick="deleteTool('${tool.id}')">Delete</button>
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
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;
    
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
        if (toolId) {
            // Update existing tool
            const existingTool = tools.find(t => t.id === toolId);
            if (existingTool) {
                // Find the database ID for this tool
                const response = await fetch('/api/tools', {
                    headers: getAuthHeaders()
                });
                const data = await response.json();
                const dbTool = data.tools.find(t => t.id === toolId);
                
                if (dbTool) {
                    const updateResponse = await fetch(`/api/tools/${dbTool.id}`, {
                        method: 'PUT',
                        headers: {
                            ...getAuthHeaders(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(toolData)
                    });
                    
                    if (!updateResponse.ok) {
                        throw new Error('Failed to update tool');
                    }
                }
            }
        } else {
            // Add new tool
            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(toolData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to create tool');
            }
        }
        
        // Reload tools from database
        await loadTools();
        hideModal();
        
    } catch (error) {
        console.error('Error saving tool:', error);
        alert('Failed to save tool. Please try again.');
    }
}

// Delete tool
async function deleteTool(toolId) {
    if (confirm('Are you sure you want to delete this tool?')) {
        try {
            // Find the database ID for this tool
            const response = await fetch('/api/tools', {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            const dbTool = data.tools.find(t => t.id === toolId);
            
            if (dbTool) {
                const deleteResponse = await fetch(`/api/tools/${dbTool.id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (!deleteResponse.ok) {
                    throw new Error('Failed to delete tool');
                }
                
                // Reload tools from database
                await loadTools();
            }
        } catch (error) {
            console.error('Error deleting tool:', error);
            alert('Failed to delete tool. Please try again.');
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