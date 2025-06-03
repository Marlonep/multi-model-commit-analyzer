// Tools Management
let tools = [];
let filteredTools = [];
let users = [];
let exchangeRate = 17.5;

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadTools();
    loadUsers();
    setupEventListeners();
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
        // First load tools from JSON file
        const response = await fetch('/tools-data.json');
        const data = await response.json();
        const defaultTools = data.tools;
        
        // Check for user customizations in localStorage
        const savedTools = localStorage.getItem('developerTools');
        const toolsVersion = localStorage.getItem('developerToolsVersion');
        const currentVersion = '3'; // Increment this when updating default tools
        
        if (savedTools && toolsVersion === currentVersion) {
            // Merge default tools with saved customizations
            const savedToolsArray = JSON.parse(savedTools);
            const defaultIds = defaultTools.map(t => t.id);
            
            // Start with default tools
            tools = [...defaultTools];
            
            // Add any custom tools that don't exist in defaults
            savedToolsArray.forEach(savedTool => {
                if (!defaultIds.includes(savedTool.id) && !savedTool.id.startsWith('tool_')) {
                    tools.push(savedTool);
                }
            });
        } else {
            // Use default tools from JSON
            tools = defaultTools;
            localStorage.setItem('developerToolsVersion', currentVersion);
            saveTools();
        }
        
        filteredTools = [...tools];
        renderTools();
    } catch (error) {
        console.error('Error loading tools:', error);
        // Fallback to empty array if file loading fails
        tools = [];
        filteredTools = [];
        renderTools();
    }
}

// Also export function to get all available tools for other pages
window.getAvailableTools = async function() {
    try {
        const response = await fetch('/tools-data.json');
        const data = await response.json();
        return data.tools;
    } catch (error) {
        console.error('Error loading tools data:', error);
        return [];
    }
}

// Save tools to localStorage
function saveTools() {
    localStorage.setItem('developerTools', JSON.stringify(tools));
}

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
function handleToolSubmit(e) {
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
    
    if (toolId) {
        // Update existing tool
        const index = tools.findIndex(t => t.id === toolId);
        if (index !== -1) {
            tools[index] = toolData;
        }
    } else {
        // Add new tool
        tools.push(toolData);
    }
    
    saveTools();
    filterTools(); // This will also re-render
    hideModal();
}

// Delete tool
function deleteTool(toolId) {
    if (confirm('Are you sure you want to delete this tool?')) {
        tools = tools.filter(t => t.id !== toolId);
        saveTools();
        filterTools(); // This will also re-render
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Force reset tools to defaults (can be called from console)
window.resetTools = function() {
    localStorage.removeItem('developerTools');
    localStorage.removeItem('developerToolsVersion');
    location.reload();
};

// Load users for the cost calculator
async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: getAuthHeaders()
        });
        users = await response.json();
        
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
        userTools.forEach(toolId => {
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