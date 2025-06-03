// Tools Management
let tools = [];
let filteredTools = [];

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadTools();
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
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('toolModal');
        if (event.target === modal) {
            hideModal();
        }
    });
}

// Load tools from localStorage or initialize with sample data
function loadTools() {
    const savedTools = localStorage.getItem('developerTools');
    // Check if we need to update with new tools (version check)
    const toolsVersion = localStorage.getItem('developerToolsVersion');
    const currentVersion = '2'; // Increment this when adding new default tools
    
    if (savedTools && toolsVersion === currentVersion) {
        tools = JSON.parse(savedTools);
    } else {
        // Initialize with sample tools or merge new tools
        localStorage.setItem('developerToolsVersion', currentVersion);
        // Initialize with sample tools
        tools = [
            {
                id: generateId(),
                image: 'https://code.visualstudio.com/assets/favicon.ico',
                name: 'Visual Studio Code',
                category: 'IDE/Code Editors',
                description: 'Free, open-source code editor with extensive plugin ecosystem',
                price: 'Free',
                website: 'https://code.visualstudio.com/'
            },
            {
                id: generateId(),
                image: 'https://github.githubassets.com/favicons/favicon.svg',
                name: 'GitHub',
                category: 'Version Control',
                description: 'Web-based hosting service for version control using Git',
                price: '$4/user/month',
                website: 'https://github.com/'
            },
            {
                id: generateId(),
                image: 'https://www.jenkins.io/favicon.ico',
                name: 'Jenkins',
                category: 'CI/CD',
                description: 'Open-source automation server for continuous integration and delivery',
                price: 'Free',
                website: 'https://www.jenkins.io/'
            },
            {
                id: generateId(),
                image: 'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
                name: 'Jira',
                category: 'Project Management',
                description: 'Issue tracking and project management tool for agile teams',
                price: '$7.75/user/month',
                website: 'https://www.atlassian.com/software/jira'
            },
            {
                id: generateId(),
                image: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
                name: 'Slack',
                category: 'Communication',
                description: 'Team collaboration and messaging platform',
                price: '$7.25/user/month',
                website: 'https://slack.com/'
            },
            {
                id: generateId(),
                image: 'https://www.docker.com/wp-content/uploads/2022/03/vertical-logo-monochromatic.png',
                name: 'Docker',
                category: 'Cloud Services',
                description: 'Platform for developing, shipping, and running applications in containers',
                price: '$5/user/month',
                website: 'https://www.docker.com/'
            },
            {
                id: generateId(),
                image: 'https://www.postman.com/_ar-assets/images/favicon-1-48.png',
                name: 'Postman',
                category: 'API Development',
                description: 'API development and testing platform',
                price: '$12/user/month',
                website: 'https://www.postman.com/'
            },
            {
                id: generateId(),
                image: 'https://github.com/favicon.ico',
                name: 'GitHub Copilot',
                category: 'AI Assistants',
                description: 'AI-powered code completion and suggestion tool',
                price: '$10/user/month',
                website: 'https://github.com/features/copilot'
            },
            {
                id: generateId(),
                image: 'https://lh3.googleusercontent.com/sYGCKFdty43En6UhLRd_M0ZxiLbTHhdVmuRe0M0OvnCVmNiWeLhtBRmAYL5vvEZJ_WwihKzYh-3wMsaYUDvvKh9e-g=w128-h128-e365-rj-sc0x00ffffff',
                name: 'Google Workspace',
                category: 'Communication',
                description: 'Suite of cloud computing, productivity and collaboration tools',
                price: '$12/user/month',
                website: 'https://workspace.google.com/'
            },
            {
                id: generateId(),
                image: 'https://app.flutterflow.io/favicon.png',
                name: 'FlutterFlow',
                category: 'IDE/Code Editors',
                description: 'Visual development platform for building native mobile and web apps',
                price: '$30/user/month',
                website: 'https://flutterflow.io/'
            },
            {
                id: generateId(),
                image: 'https://claude.ai/favicon.ico',
                name: 'Claude',
                category: 'AI Assistants',
                description: 'AI assistant by Anthropic for analysis, writing, and coding',
                price: '$20/user/month',
                website: 'https://claude.ai/'
            },
            {
                id: generateId(),
                image: 'https://chat.openai.com/apple-touch-icon.png',
                name: 'OpenAI ChatGPT',
                category: 'AI Assistants',
                description: 'Advanced AI language model for various tasks including coding',
                price: '$20/user/month',
                website: 'https://openai.com/'
            },
            {
                id: generateId(),
                image: 'https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png',
                name: 'Google AI Studio',
                category: 'AI Assistants',
                description: 'Platform for prototyping and building with Google\'s Gemini models',
                price: 'Free',
                website: 'https://aistudio.google.com/'
            },
            {
                id: generateId(),
                image: 'https://x.ai/favicon.ico',
                name: 'Grok',
                category: 'AI Assistants',
                description: 'AI assistant by xAI with real-time knowledge and humor',
                price: '$16/user/month',
                website: 'https://x.ai/'
            },
            {
                id: generateId(),
                image: 'https://cdn.sanity.io/images/599r6htc/localized/46a76c802176eb17b04e12108de7e7e0f3736dc6-1024x1024.png?w=48&h=48&q=75&fit=max&auto=format',
                name: 'Figma',
                category: 'Other',
                description: 'Collaborative interface design and prototyping tool',
                price: '$15/user/month',
                website: 'https://www.figma.com/'
            }
        ];
        saveTools();
    }
    
    filteredTools = [...tools];
    renderTools();
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