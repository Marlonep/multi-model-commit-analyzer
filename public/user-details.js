// Get user name from URL
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('user');
let userCommits = [];
let githubConfig = null;

// Check if user has permission to view this user's details
function checkUserDetailsAccess() {
    const currentUser = getUserData();
    if (!currentUser) return false;
    
    // Users can view their own details, admins can view all
    if (currentUser.role === 'user') {
        // Check if the requested user matches current user (by username or name)
        const isOwnProfile = currentUser.username.toLowerCase() === userName.toLowerCase() || 
                           currentUser.name.toLowerCase() === userName.toLowerCase();
        
        if (!isOwnProfile) {
            window.location.href = '/index.html';
            return false;
        }
    }
    return true;
}

// User data will be fetched from API
let userData = {
    email: '',
    phone: '',
    whatsappAvailable: false,
    minHoursPerDay: 8,
    organizations: [],
    tools: []
};

// Chart instances
let metricsChart = null;
let commitsPerDayChart = null;
let linesPerDayChart = null;

// Fetch GitHub configuration
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

// Load user details
async function loadUserDetails() {
    if (!userName) {
        window.location.href = '/users.html';
        return;
    }
    
    // Check permissions first
    if (!checkUserDetailsAccess()) {
        return;
    }

    try {
        // Load GitHub config first
        await loadGithubConfig();
        
        // Fetch user details from API
        const userDetailsResponse = await fetch(`/api/users/${userName}/details`, {
            headers: getAuthHeaders()
        });
        if (userDetailsResponse.ok) {
            const fetchedData = await userDetailsResponse.json();
            // Ensure all required fields exist
            userData = {
                email: fetchedData.email || '',
                phone: fetchedData.phone || '',
                whatsappAvailable: fetchedData.whatsappAvailable || false,
                minHoursPerDay: fetchedData.minHoursPerDay || 8,
                organizations: fetchedData.organizations || [],
                tools: fetchedData.tools || []
            };
        }
        
        // Fetch all commits
        const response = await fetch('/api/commits', {
            headers: getAuthHeaders()
        });
        const allCommits = await response.json();
        
        // Filter commits for this user
        userCommits = allCommits.filter(commit => commit.user === userName);
        
        // Sort by date descending
        userCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayUserInfo();
        displayUserStats();
        displayContactInfo();
        displayOrganizations();
        displayTools();
        displayToolSubscriptions();
        displayContributionGraph();
        displayCommitsTable();
        createCharts();
    } catch (error) {
        console.error('Error loading user details:', error);
        alert('Error loading user details');
        window.location.href = '/users.html';
    }
}

// Display user information
function displayUserInfo() {
    document.getElementById('userName').textContent = userName;
    document.getElementById('totalCommits').textContent = userCommits.length;
    
    const totalHours = userCommits.reduce((sum, commit) => sum + (commit.averageEstimatedHours || 0), 0);
    const totalHoursWithAI = userCommits.reduce((sum, commit) => sum + (commit.averageEstimatedHoursWithAi || 0), 0);
    const timeSaved = totalHours - totalHoursWithAI;
    
    document.getElementById('totalHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('timeSaved').textContent = timeSaved.toFixed(1) + 'h (' + 
        ((timeSaved / totalHours * 100) || 0).toFixed(0) + '%)';
}

// Display user statistics
function displayUserStats() {
    // Calculate averages
    const avgQuality = userCommits.reduce((sum, c) => sum + c.averageCodeQuality, 0) / userCommits.length;
    const avgDevLevel = userCommits.reduce((sum, c) => sum + c.averageDevLevel, 0) / userCommits.length;
    const avgComplexity = userCommits.reduce((sum, c) => sum + c.averageComplexity, 0) / userCommits.length;
    const avgAiPercent = userCommits.reduce((sum, c) => sum + (c.averageAiPercentage || 0), 0) / userCommits.length;
    
    // Calculate totals
    const totalLinesAdded = userCommits.reduce((sum, c) => sum + (c.linesAdded || 0), 0);
    const totalLinesDeleted = userCommits.reduce((sum, c) => sum + (c.linesDeleted || 0), 0);
    const totalLines = totalLinesAdded - totalLinesDeleted;
    const totalCost = userCommits.reduce((sum, c) => sum + (c.totalCost || 0), 0);
    
    // Update UI
    document.getElementById('avgQuality').textContent = avgQuality.toFixed(1);
    document.getElementById('avgDevLevel').textContent = avgDevLevel.toFixed(1) + ' (' + getDevLevel(avgDevLevel) + ')';
    document.getElementById('avgComplexity').textContent = avgComplexity.toFixed(1);
    document.getElementById('avgAiPercent').textContent = avgAiPercent.toFixed(0) + '%';
    document.getElementById('totalLines').textContent = totalLines.toLocaleString();
    document.getElementById('totalCost').textContent = '$' + totalCost.toFixed(2);
}

// Display contribution graph
function displayContributionGraph() {
    const currentYear = new Date().getFullYear();
    const yearSelector = document.getElementById('yearSelector');
    
    // Set current year as selected
    yearSelector.value = currentYear;
    
    // Build contribution graph for current year
    buildContributionGraph(currentYear);
    
    // Add year selector event listener
    yearSelector.addEventListener('change', (e) => {
        buildContributionGraph(parseInt(e.target.value));
    });
}

// Build contribution graph for a specific year
function buildContributionGraph(year) {
    const startDate = new Date(year, 0, 1); // January 1st
    let endDate = new Date(year, 11, 31); // December 31st
    const today = new Date();
    
    // If the selected year is current year, use today or the latest commit date, whichever is later
    if (year === today.getFullYear()) {
        // Find the latest commit date for this year
        let latestCommitDate = today;
        userCommits.forEach(commit => {
            const commitDate = new Date(commit.timestamp);
            if (commitDate.getFullYear() === year && commitDate > latestCommitDate) {
                latestCommitDate = commitDate;
            }
        });
        
        // Use the later of today or the latest commit date
        endDate = new Date(Math.max(today.getTime(), latestCommitDate.getTime()));
    }
    
    // Calculate contributions per day
    const contributionsMap = {};
    let totalContributions = 0;
    
    userCommits.forEach(commit => {
        const commitDate = new Date(commit.timestamp);
        if (commitDate.getFullYear() === year) {
            const dateKey = commitDate.toISOString().split('T')[0];
            contributionsMap[dateKey] = (contributionsMap[dateKey] || 0) + 1;
            totalContributions++;
        }
    });
    
    // Update contribution count
    document.getElementById('yearContributions').textContent = totalContributions;
    
    // Generate month labels
    const monthsLabels = document.getElementById('monthsLabels');
    monthsLabels.innerHTML = '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Find the first Sunday on or before January 1st (for grid alignment)
    const firstDay = new Date(year, 0, 1);
    const gridStartDay = new Date(firstDay);
    gridStartDay.setDate(firstDay.getDate() - firstDay.getDay());
    
    // Calculate the number of weeks needed to cover from gridStartDay to endDate
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((endDate.getTime() - gridStartDay.getTime() + millisecondsPerWeek) / millisecondsPerWeek);
    const weeksToShow = Math.max(53, totalWeeks); // At least 53 weeks, but more if needed
    
    // Calculate week positions for each month
    const monthPositions = [];
    
    // Generate month labels for all months in the date range
    const currentMonth = new Date(gridStartDay);
    currentMonth.setDate(1); // Set to first day of month
    
    while (currentMonth <= endDate) {
        // Set time to noon to avoid timezone issues
        const monthStart = new Date(currentMonth);
        monthStart.setHours(12, 0, 0, 0);
        const gridStartNoon = new Date(gridStartDay);
        gridStartNoon.setHours(12, 0, 0, 0);
        
        // Calculate days since grid start
        const daysSinceStart = Math.round((monthStart - gridStartNoon) / (24 * 60 * 60 * 1000));
        // Calculate which week column this falls into
        const weekColumn = Math.floor(daysSinceStart / 7);
        
        // Only add if this month is within our display year
        if (monthStart.getFullYear() === year) {
            monthPositions.push({
                month: months[monthStart.getMonth()],
                week: weekColumn
            });
        }
        
        // Move to next month
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    // Create month labels directly without container
    monthsLabels.innerHTML = '';
    
    monthPositions.forEach((pos, index) => {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = pos.month;
        monthLabel.style.position = 'absolute';
        monthLabel.style.left = (pos.week * 14) + 'px'; // week * (cell width + gap) = 12 + 2
        
        // Don't show month label if it's outside the grid or overlaps with previous
        if (pos.week < weeksToShow) {
            // Check if this label would overlap with the previous one
            if (index > 0 && pos.week - monthPositions[index - 1].week < 3) {
                // Skip this label if it's too close to the previous one
                return;
            }
            monthsLabels.appendChild(monthLabel);
        }
    });
    
    // Generate contribution grid
    const grid = document.getElementById('contributionGrid');
    grid.innerHTML = '';
    
    // Set the grid template columns dynamically based on weeks to show
    grid.style.gridTemplateColumns = `repeat(${weeksToShow}, 12px)`;
    
    // Create the grid
    const currentDate = new Date(gridStartDay);
    const tooltip = createTooltip();
    
    for (let week = 0; week < weeksToShow; week++) {
        for (let day = 0; day < 7; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'contribution-day';
            
            const dateKey = currentDate.toISOString().split('T')[0];
            const contributions = contributionsMap[dateKey] || 0;
            
            // Calculate contribution level (0-4)
            let level = 0;
            if (contributions > 0) {
                if (contributions === 1) level = 1;
                else if (contributions <= 3) level = 2;
                else if (contributions <= 5) level = 3;
                else level = 4;
            }
            
            dayElement.setAttribute('data-level', level);
            dayElement.setAttribute('data-date', dateKey);
            dayElement.setAttribute('data-count', contributions);
            
            // Only show days within the year and up to endDate
            if (currentDate.getFullYear() === year && currentDate <= endDate) {
                dayElement.style.visibility = 'visible';
            } else {
                dayElement.style.visibility = 'hidden';
            }
            
            // Add hover tooltip
            dayElement.addEventListener('mouseenter', (e) => showTooltip(e, tooltip));
            dayElement.addEventListener('mouseleave', () => hideTooltip(tooltip));
            
            grid.appendChild(dayElement);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
}

// Create tooltip element
function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'contribution-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    return tooltip;
}

// Show tooltip
function showTooltip(event, tooltip) {
    const target = event.target;
    const date = new Date(target.getAttribute('data-date'));
    const count = parseInt(target.getAttribute('data-count'));
    
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    tooltip.innerHTML = `
        <strong>${count} contribution${count !== 1 ? 's' : ''}</strong> on ${dateStr}
    `;
    
    // Position tooltip
    const rect = target.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
}

// Hide tooltip
function hideTooltip(tooltip) {
    tooltip.style.display = 'none';
}

// Display commits table
function displayCommitsTable() {
    const tbody = document.getElementById('userCommitsBody');
    tbody.innerHTML = '';
    
    userCommits.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleString();
        
        row.innerHTML = `
            <td>${date}</td>
            <td>
                <a href="https://github.com/${githubConfig.username}/${githubConfig.repository}/commit/${commit.commitHash}" 
                   target="_blank" class="table-link" title="View on GitHub">
                    ${commit.commitHash.substring(0, 8)}
                </a>
            </td>
            <td>
                <a href="https://github.com/${githubConfig.username}/${githubConfig.repository}" 
                   target="_blank" class="table-link" title="View Repository">
                    ${commit.project}
                </a>
            </td>
            <td>${commit.organization || 'Unknown'}</td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 40)}</td>
            <td>${commit.fileChanges || 0}</td>
            <td>+${commit.linesAdded || 0}</td>
            <td>-${commit.linesDeleted || 0}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>
                <button class="view-details" onclick="viewCommitDetails(${index})">
                    Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Create charts
function createCharts() {
    createMetricsChart();
    createCommitsPerDayChart();
    createLinesPerDayChart();
}

// Create performance metrics chart
function createMetricsChart() {
    const ctx = document.getElementById('metricsChart').getContext('2d');
    
    const avgQuality = userCommits.reduce((sum, c) => sum + c.averageCodeQuality, 0) / userCommits.length;
    const avgDevLevel = userCommits.reduce((sum, c) => sum + c.averageDevLevel, 0) / userCommits.length;
    const avgComplexity = userCommits.reduce((sum, c) => sum + c.averageComplexity, 0) / userCommits.length;
    
    metricsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Code Quality', 'Dev Level', 'Complexity'],
            datasets: [{
                label: 'Average Score',
                data: [avgQuality, avgDevLevel * 1.67, avgComplexity], // Scale dev level to 5
                backgroundColor: [
                    'rgba(57, 255, 20, 0.6)',
                    'rgba(255, 215, 0, 0.6)',
                    'rgba(0, 191, 255, 0.6)'
                ],
                borderColor: [
                    'rgba(57, 255, 20, 1)',
                    'rgba(255, 215, 0, 1)',
                    'rgba(0, 191, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Create commits per day chart
function createCommitsPerDayChart() {
    const ctx = document.getElementById('commitsPerDayChart').getContext('2d');
    
    // Group commits by date
    const commitsByDate = {};
    userCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        commitsByDate[date] = (commitsByDate[date] || 0) + 1;
    });
    
    // Sort dates and prepare data
    const dates = Object.keys(commitsByDate).sort((a, b) => new Date(a) - new Date(b));
    const counts = dates.map(date => commitsByDate[date]);
    
    commitsPerDayChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Commits',
                data: counts,
                backgroundColor: 'rgba(57, 255, 20, 0.6)',
                borderColor: 'rgba(57, 255, 20, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Create lines per day chart
function createLinesPerDayChart() {
    const ctx = document.getElementById('linesPerDayChart').getContext('2d');
    
    // Group lines by date
    const linesByDate = {};
    userCommits.forEach(commit => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        if (!linesByDate[date]) {
            linesByDate[date] = { added: 0, deleted: 0 };
        }
        linesByDate[date].added += commit.linesAdded || 0;
        linesByDate[date].deleted += commit.linesDeleted || 0;
    });
    
    // Sort dates and prepare data
    const dates = Object.keys(linesByDate).sort((a, b) => new Date(a) - new Date(b));
    const linesAdded = dates.map(date => linesByDate[date].added);
    const linesDeleted = dates.map(date => -linesByDate[date].deleted); // Negative for visual effect
    
    linesPerDayChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Lines Added',
                data: linesAdded,
                backgroundColor: 'rgba(57, 255, 20, 0.6)',
                borderColor: 'rgba(57, 255, 20, 1)',
                borderWidth: 1
            }, {
                label: 'Lines Deleted',
                data: linesDeleted,
                backgroundColor: 'rgba(255, 69, 0, 0.6)',
                borderColor: 'rgba(255, 69, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#c9d1d9'
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#c9d1d9',
                        callback: function(value) {
                            return Math.abs(value);
                        }
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                x: {
                    ticks: {
                        color: '#c9d1d9'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
}

// Helper functions
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function viewCommitDetails(index) {
    // Get the global index in all commits
    fetch('/api/commits', {
        headers: getAuthHeaders()
    })
        .then(response => response.json())
        .then(allCommits => {
            const commit = userCommits[index];
            const globalIndex = allCommits.findIndex(c => c.commitHash === commit.commitHash);
            window.location.href = `/details.html?index=${globalIndex}`;
        });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('commitsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#userCommitsBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

// Display contact information
function displayContactInfo() {
    document.getElementById('userEmail').textContent = userData.email || 'Not provided';
    document.getElementById('userPhone').textContent = userData.phone || 'Not provided';
    document.getElementById('whatsappAvailable').checked = userData.whatsappAvailable || false;
    document.getElementById('minHoursPerDay').textContent = userData.minHoursPerDay || 8;
}

// Display organizations
function displayOrganizations() {
    const orgsList = document.getElementById('organizationsList');
    orgsList.innerHTML = '';
    
    if (!userData.organizations || userData.organizations.length === 0) {
        orgsList.innerHTML = '<p style="color: #8b949e; text-align: center;">No organizations added yet</p>';
        return;
    }
    
    userData.organizations.forEach(org => {
        const orgCard = document.createElement('div');
        orgCard.className = 'organization-card';
        orgCard.innerHTML = `
            <div class="org-header">
                <h4 class="org-name">${org.name}</h4>
                <button class="remove-org-btn" onclick="removeOrganization(${org.id})" title="Remove">×</button>
            </div>
            <div class="org-details">
                <span class="org-role">${org.role}</span>
                <span class="org-date">Joined: ${new Date(org.joinDate).toLocaleDateString()}</span>
            </div>
        `;
        orgsList.appendChild(orgCard);
    });
}

// Toggle edit mode for contact fields
async function toggleEdit(field) {
    const element = document.querySelector(`[data-field="${field}"]`);
    const button = element.nextElementSibling;
    
    if (element.contentEditable === 'false') {
        element.contentEditable = 'true';
        element.focus();
        button.textContent = '✓';
        element.classList.add('editing');
        
        // Select all text for easier editing
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        element.contentEditable = 'false';
        button.textContent = '✏️';
        element.classList.remove('editing');
        
        // Update the local data
        if (field === 'email') {
            userData.email = element.textContent;
        } else if (field === 'phone') {
            userData.phone = element.textContent;
        } else if (field === 'minHoursPerDay') {
            const hours = parseFloat(element.textContent);
            userData.minHoursPerDay = isNaN(hours) || hours <= 0 ? 8 : hours;
            element.textContent = userData.minHoursPerDay; // Update display with validated value
        }
        
        // Save to API
        await saveUserDetails();
    }
}

// Toggle WhatsApp edit mode
async function toggleWhatsAppEdit() {
    const checkbox = document.getElementById('whatsappAvailable');
    const button = checkbox.parentElement.querySelector('.edit-btn');
    
    if (checkbox.disabled) {
        checkbox.disabled = false;
        button.textContent = '✓';
    } else {
        checkbox.disabled = true;
        button.textContent = '✏️';
        userData.whatsappAvailable = checkbox.checked;
        
        // Save to API
        await saveUserDetails();
    }
}

// Show add organization dialog
async function showAddOrganization() {
    const orgName = prompt('Enter organization name:');
    if (!orgName) return;
    
    const role = prompt('Enter your role:');
    if (!role) return;
    
    const newOrg = {
        id: Date.now(), // Simple ID generation
        name: orgName,
        role: role,
        joinDate: new Date().toISOString()
    };
    
    if (!userData.organizations) {
        userData.organizations = [];
    }
    userData.organizations.push(newOrg);
    displayOrganizations();
    
    // Save to API
    await saveUserDetails();
}

// Remove organization
async function removeOrganization(orgId) {
    if (confirm('Are you sure you want to remove this organization?')) {
        userData.organizations = userData.organizations.filter(org => org.id !== orgId);
        displayOrganizations();
        
        // Save to API
        await saveUserDetails();
    }
}

// Save user details to API
async function saveUserDetails() {
    try {
        const response = await fetch(`/api/users/${userName}/details`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Changes saved successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification('Failed to save changes: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Error saving user details:', error);
        showNotification('Failed to save changes. Please try again.', 'error');
    }
}

// Display selected tools
function displayTools() {
    const toolsList = document.getElementById('selectedToolsList');
    toolsList.innerHTML = '';
    
    if (!userData.tools || userData.tools.length === 0) {
        toolsList.innerHTML = '<div class="no-tools-message">No tools selected</div>';
        return;
    }
    
    // Get active tools
    const activeTools = userData.tools.filter(tool => {
        // Handle both old format (string) and new format (object)
        if (typeof tool === 'string') {
            return true;
        }
        return tool.status === 'active';
    });
    
    activeTools.forEach(tool => {
        const toolId = typeof tool === 'string' ? tool : tool.toolId;
        const toolChip = document.createElement('div');
        toolChip.className = 'tool-chip';
        toolChip.setAttribute('data-tool-id', toolId);
        
        // We'll update this with actual tool data
        toolChip.innerHTML = `
            <span class="tool-name-loading">Loading...</span>
            <button class="remove-tool" onclick="removeTool('${toolId}')">&times;</button>
        `;
        
        toolsList.appendChild(toolChip);
    });
    
    if (activeTools.length === 0) {
        toolsList.innerHTML = '<div class="no-tools-message">No active tools</div>';
    }
    
    // Load tool details
    loadToolDetails();
}

// Load actual tool details from tools data
async function loadToolDetails() {
    try {
        const availableTools = await window.getAvailableTools();
        const toolChips = document.querySelectorAll('.tool-chip');
        
        toolChips.forEach(chip => {
            const toolId = chip.getAttribute('data-tool-id');
            const tool = availableTools.find(t => t.id === toolId);
            
            if (tool) {
                chip.innerHTML = `
                    ${tool.image ? `<img src="${tool.image}" alt="${tool.name}" class="tool-icon">` : ''}
                    <span class="tool-name">${tool.name}</span>
                    <button class="remove-tool" onclick="removeTool('${toolId}')">&times;</button>
                `;
            } else {
                chip.innerHTML = `
                    <span class="tool-name">Unknown Tool</span>
                    <button class="remove-tool" onclick="removeTool('${toolId}')">&times;</button>
                `;
            }
        });
    } catch (error) {
        console.error('Error loading tool details:', error);
    }
}

// Display tool subscriptions table
async function displayToolSubscriptions() {
    const tbody = document.getElementById('toolSubscriptionsBody');
    tbody.innerHTML = '';
    
    if (!userData.tools || userData.tools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No tool subscriptions</td></tr>';
        updateSubscriptionSummary(0, 0);
        return;
    }
    
    try {
        const availableTools = await window.getAvailableTools();
        let activeCount = 0;
        let totalMonthlyCost = 0;
        
        userData.tools.forEach(toolData => {
            // Handle both old format (string) and new format (object)
            let toolId, status, subscribedDate;
            
            if (typeof toolData === 'string') {
                // Old format - convert to new
                toolId = toolData;
                status = 'active';
                subscribedDate = new Date().toISOString();
            } else {
                toolId = toolData.toolId;
                status = toolData.status;
                subscribedDate = toolData.subscribedDate;
            }
            
            const tool = availableTools.find(t => t.id === toolId);
            if (!tool) return;
            
            const row = document.createElement('tr');
            const isActive = status === 'active';
            const monthlyCost = tool.costPerMonth || 0;
            
            if (isActive) {
                activeCount++;
                totalMonthlyCost += monthlyCost;
            }
            
            row.innerHTML = `
                <td>
                    ${tool.image ? `<img src="${tool.image}" alt="${tool.name}" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 8px;">` : ''}
                    ${tool.name}
                </td>
                <td>
                    <span class="subscription-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </td>
                <td>
                    <span class="subscription-cost ${monthlyCost === 0 ? 'free' : ''}">
                        ${monthlyCost === 0 ? 'Free' : `$${monthlyCost.toFixed(2)}/month`}
                    </span>
                </td>
                <td>${new Date(subscribedDate).toLocaleDateString()}</td>
                <td>
                    <div class="subscription-actions">
                        ${isActive ? 
                            `<button class="btn-cancel-subscription" onclick="cancelSubscription('${toolId}')">Cancel</button>` :
                            `<button class="btn-reactivate-subscription" onclick="reactivateSubscription('${toolId}')">Reactivate</button>`
                        }
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        updateSubscriptionSummary(activeCount, totalMonthlyCost);
        
    } catch (error) {
        console.error('Error displaying tool subscriptions:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">Error loading subscriptions</td></tr>';
    }
}

// Update subscription summary
function updateSubscriptionSummary(activeCount, totalCost) {
    document.getElementById('activeSubscriptionsCount').textContent = activeCount;
    document.getElementById('totalMonthlyCost').textContent = `$${totalCost.toFixed(2)}`;
}

// Cancel a subscription
async function cancelSubscription(toolId) {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
        return;
    }
    
    // Find and update the tool subscription
    userData.tools = userData.tools.map(tool => {
        if (typeof tool === 'string') {
            // Convert old format to new format
            if (tool === toolId) {
                return {
                    toolId: tool,
                    status: 'inactive',
                    subscribedDate: new Date().toISOString()
                };
            }
            return {
                toolId: tool,
                status: 'active',
                subscribedDate: new Date().toISOString()
            };
        } else if (tool.toolId === toolId) {
            return {
                ...tool,
                status: 'inactive'
            };
        }
        return tool;
    });
    
    await saveUserDetails();
    displayTools();
    displayToolSubscriptions();
}

// Reactivate a subscription
async function reactivateSubscription(toolId) {
    // Find and update the tool subscription
    userData.tools = userData.tools.map(tool => {
        if (typeof tool === 'string') {
            // Convert old format to new format
            return {
                toolId: tool,
                status: tool === toolId ? 'active' : 'active',
                subscribedDate: new Date().toISOString()
            };
        } else if (tool.toolId === toolId) {
            return {
                ...tool,
                status: 'active'
            };
        }
        return tool;
    });
    
    await saveUserDetails();
    displayTools();
    displayToolSubscriptions();
}

// Show tool selector modal
async function showToolSelector() {
    const modal = document.getElementById('toolSelectorModal');
    const toolsGrid = document.getElementById('toolsGrid');
    
    // Load available tools
    try {
        const availableTools = await window.getAvailableTools();
        
        // Filter out already selected tools
        const unselectedTools = availableTools.filter(tool => {
            if (!userData.tools || userData.tools.length === 0) return true;
            
            // Check if tool is already in user's tools (handle both formats)
            return !userData.tools.some(userTool => {
                const toolId = typeof userTool === 'string' ? userTool : userTool.toolId;
                return toolId === tool.id;
            });
        });
        
        // Populate tools grid
        toolsGrid.innerHTML = '';
        unselectedTools.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.className = 'tool-card';
            toolCard.innerHTML = `
                <div class="tool-card-content">
                    ${tool.image ? `<img src="${tool.image}" alt="${tool.name}" class="tool-card-icon">` : '<div class="tool-card-icon-placeholder">?</div>'}
                    <h4 class="tool-card-name">${tool.name}</h4>
                    <span class="tool-card-category">${tool.category}</span>
                    <p class="tool-card-description">${tool.description}</p>
                </div>
            `;
            
            toolCard.addEventListener('click', () => selectTool(tool.id));
            toolsGrid.appendChild(toolCard);
        });
        
        if (unselectedTools.length === 0) {
            toolsGrid.innerHTML = '<div class="no-tools-available">All available tools have been selected</div>';
        }
        
        modal.style.display = 'block';
        
        // Setup search functionality
        const searchInput = document.getElementById('toolSearchInput');
        searchInput.value = '';
        searchInput.focus();
        searchInput.addEventListener('input', () => filterToolsInModal(unselectedTools));
        
    } catch (error) {
        console.error('Error loading tools:', error);
        toolsGrid.innerHTML = '<div class="error-message">Failed to load tools</div>';
    }
}

// Filter tools in modal based on search
function filterToolsInModal(tools) {
    const searchTerm = document.getElementById('toolSearchInput').value.toLowerCase();
    const toolCards = document.querySelectorAll('.tool-card');
    
    toolCards.forEach((card, index) => {
        const tool = tools[index];
        const matches = !searchTerm || 
            tool.name.toLowerCase().includes(searchTerm) ||
            tool.category.toLowerCase().includes(searchTerm) ||
            tool.description.toLowerCase().includes(searchTerm);
        
        card.style.display = matches ? 'block' : 'none';
    });
}

// Hide tool selector modal
function hideToolSelector() {
    const modal = document.getElementById('toolSelectorModal');
    modal.style.display = 'none';
}

// Select a tool
async function selectTool(toolId) {
    if (!userData.tools) {
        userData.tools = [];
    }
    
    // Check if tool already exists (handle both formats)
    const toolExists = userData.tools.some(tool => {
        const existingToolId = typeof tool === 'string' ? tool : tool.toolId;
        return existingToolId === toolId;
    });
    
    if (!toolExists) {
        // Add as new format
        userData.tools.push({
            toolId: toolId,
            status: 'active',
            subscribedDate: new Date().toISOString()
        });
        displayTools();
        displayToolSubscriptions();
        await saveUserDetails();
    }
    
    hideToolSelector();
}

// Remove a tool
async function removeTool(toolId) {
    if (!userData.tools) return;
    
    if (confirm('Are you sure you want to remove this tool completely?')) {
        userData.tools = userData.tools.filter(tool => {
            const currentToolId = typeof tool === 'string' ? tool : tool.toolId;
            return currentToolId !== toolId;
        });
        displayTools();
        displayToolSubscriptions();
        await saveUserDetails();
    }
}

// Show notification message
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color based on type
    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else {
        notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Make functions available globally for onclick handlers
window.toggleEdit = toggleEdit;
window.toggleWhatsAppEdit = toggleWhatsAppEdit;
window.showAddOrganization = showAddOrganization;
window.removeOrganization = removeOrganization;
window.viewCommitDetails = viewCommitDetails;
window.showToolSelector = showToolSelector;
window.hideToolSelector = hideToolSelector;
window.removeTool = removeTool;
window.cancelSubscription = cancelSubscription;
window.reactivateSubscription = reactivateSubscription;

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    setupSearch();
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('toolSelectorModal');
    if (event.target === modal) {
        hideToolSelector();
    }
});