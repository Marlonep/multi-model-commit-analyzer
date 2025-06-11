// Get user name from URL
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('user');
let userCommits = [];
let githubConfig = null;

// Check if user has permission to view this user's details
function checkUserDetailsAccess() {
    const currentUser = getUserData();
    console.log('Current user:', currentUser);
    console.log('Requested user:', userName);
    
    if (!currentUser) {
        console.log('No current user data found');
        return false;
    }
    
    // Users can view their own details, admins can view all
    if (currentUser.role === 'user') {
        // Check if the requested user matches current user (by username or name)
        const isOwnProfile = currentUser.username.toLowerCase() === userName.toLowerCase() || 
                           currentUser.name.toLowerCase() === userName.toLowerCase();
        
        if (!isOwnProfile) {
            console.log('User trying to access another user profile, redirecting...');
            window.location.href = '/index.html';
            return false;
        }
    }
    
    console.log('Access granted for user details');
    return true;
}

// User data will be fetched from API
let userData = {
    email: '',
    phone: '',
    whatsappAvailable: false,
    minHoursPerDay: 8,
    organizations: []
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
    console.log('Loading user details for:', userName);
    
    if (!userName) {
        window.location.href = '/users.html';
        return;
    }
    
    // Check permissions first
    if (!checkUserDetailsAccess()) {
        console.log('Access denied for user details');
        return;
    }

    try {
        // Load GitHub config first
        await loadGithubConfig();
        
        // Fetch user details from API
        console.log('Fetching user details with headers:', getAuthHeaders());
        const userDetailsResponse = await fetch(`/api/users/${userName}/details`, {
            headers: getAuthHeaders()
        });
        console.log('User details response status:', userDetailsResponse.status);
        
        if (userDetailsResponse.ok) {
            const fetchedData = await userDetailsResponse.json();
            console.log('User details fetched:', fetchedData);
            // Ensure all required fields exist
            userData = {
                email: fetchedData.email || '',
                phone: fetchedData.phone || '',
                whatsappAvailable: fetchedData.whatsappAvailable || false,
                minHoursPerDay: fetchedData.minHoursPerDay || 8,
                organizations: fetchedData.organizations || []
            };
        }
        
        // Fetch all commits
        console.log('Fetching commits...');
        const response = await fetch('/api/commits', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const allCommits = await response.json();
        console.log('Total commits fetched:', allCommits.length);
        
        // Try to find system user by username to get their GitHub username
        let githubUsername = userName;
        try {
            const systemUsersResponse = await fetch('/api/system-users', {
                headers: getAuthHeaders()
            });
            if (systemUsersResponse.ok) {
                const systemUsers = await systemUsersResponse.json();
                const systemUser = systemUsers.find(u => u.username === userName);
                if (systemUser && systemUser.github_username) {
                    githubUsername = systemUser.github_username;
                    console.log('Using GitHub username:', githubUsername);
                }
            }
        } catch (error) {
            console.log('Could not fetch system users, using default username');
        }
        
        // Filter commits for this user (match by GitHub username in commits)
        userCommits = allCommits.filter(commit => commit.githubUsername === githubUsername);
        console.log('User commits found:', userCommits.length);
        
        // Fallback: if no commits found with GitHub username, try matching by user name
        if (userCommits.length === 0) {
            console.log('No commits found with GitHub username, trying to match by user name...');
            userCommits = allCommits.filter(commit => commit.user === githubUsername);
            console.log('Fallback user commits found:', userCommits.length);
        }
        
        // Sort by date descending
        userCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayUserInfo();
        displayUserStats();
        displayContributionGraph();
        displayCommitsTable();
        createCharts();
    } catch (error) {
        console.error('Error loading user details:', error);
        alert('Error loading user details: ' + error.message);
        window.location.href = '/users.html';
    }
}

// Display user information (unified section)
function displayUserInfo() {
    // Basic user info
    document.getElementById('userName').textContent = userName;
    document.getElementById('totalCommits').textContent = userCommits.length;
    
    // Hours calculation
    const totalHours = userCommits.reduce((sum, commit) => sum + (commit.averageEstimatedHours || 0), 0);
    const totalHoursWithAI = userCommits.reduce((sum, commit) => sum + (commit.averageEstimatedHoursWithAi || 0), 0);
    const timeSaved = totalHours - totalHoursWithAI;
    
    document.getElementById('totalHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('timeSaved').textContent = timeSaved.toFixed(1) + 'h (' + 
        ((timeSaved / totalHours * 100) || 0).toFixed(0) + '%)';
    
    // Contact info (read-only)
    document.getElementById('userEmail').textContent = userData.email || 'Not provided';
    document.getElementById('userPhone').textContent = userData.phone || 'Not provided';
    document.getElementById('whatsappStatus').textContent = userData.whatsappAvailable ? 'Available' : 'Not available';
    document.getElementById('minHoursPerDay').textContent = userData.minHoursPerDay || 8;
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
            window.location.href = `/pages/details.html?index=${globalIndex}`;
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





// Save user details to API
async function saveUserDetails() {
    try {
        // Ensure all required fields are present
        const dataToSend = {
            email: userData.email || '',
            phone: userData.phone || '',
            whatsappAvailable: userData.whatsappAvailable || false,
            minHoursPerDay: userData.minHoursPerDay || 8,
            organizations: userData.organizations || []
        };
        
        console.log('Saving user details:', dataToSend);
        const response = await fetch(`/api/users/${userName}/details`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Changes saved successfully!', 'success');
        } else {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            try {
                const error = JSON.parse(errorText);
                showNotification('Failed to save changes: ' + error.error, 'error');
            } catch (parseError) {
                showNotification('Failed to save changes: ' + errorText, 'error');
            }
        }
    } catch (error) {
        console.error('Error saving user details:', error);
        showNotification('Failed to save changes. Please try again.', 'error');
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
window.viewCommitDetails = viewCommitDetails;

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadUserDetails();
    setupSearch();
});

