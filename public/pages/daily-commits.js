// Check authentication
checkAuth();

let allDailyCommits = [];
let filteredDailyCommits = [];
let userDetails = {};

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadDailyCommits();
    setupEventListeners();
    setDateDefaults();
});

// Set default date range (last 30 days)
function setDateDefaults() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('startDate').value = formatDateForInput(startDate);
    document.getElementById('endDate').value = formatDateForInput(endDate);
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format date for display (e.g., "Monday April 1, 2025")
function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

// Calculate hours difference for a user
function calculateHoursDiff(user, totalHours) {
    const userData = userDetails[user];
    const minHours = userData && userData.minHoursPerDay ? userData.minHoursPerDay : 8;
    return totalHours - minHours;
}

// Format hours difference for display
function formatHoursDiff(hoursDiff) {
    const sign = hoursDiff >= 0 ? '+' : '';
    const className = hoursDiff >= 0 ? 'hours-diff-positive' : 'hours-diff-negative';
    return `<span class="${className}">${sign}${hoursDiff.toFixed(1)} hours</span>`;
}

// Load daily commits data
async function loadDailyCommits() {
    try {
        // Load daily commits
        const response = await fetch('/api/daily-commits');
        if (!response.ok) {
            throw new Error('Failed to load daily commits');
        }
        
        const data = await response.json();
        allDailyCommits = data.dailyCommits || [];
        
        // Load user details for min hours calculation
        await loadUserDetails();
        
        populateUserFilter();
        applyFilters();
    } catch (error) {
        console.error('Error loading daily commits:', error);
        showError('Failed to load daily commits data');
    }
}

// Load user details for min hours per day
async function loadUserDetails() {
    try {
        const response = await fetch('/api/users/all/details', {
            headers: getAuthHeaders()
        });
        if (response.ok) {
            userDetails = await response.json();
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        // Continue without user details - will use default values
    }
}

// Populate user filter dropdown
function populateUserFilter() {
    const userFilter = document.getElementById('userFilter');
    
    console.log('All daily commits:', allDailyCommits); // Debug log
    
    // Get users from daily commits data
    const users = [...new Set(allDailyCommits.map(dc => dc.user))].sort();
    
    console.log('Extracted users:', users); // Debug log
    
    userFilter.innerHTML = '<option value="">All Users</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userFilter.appendChild(option);
        console.log('Added user to dropdown:', user); // Debug log
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('generateReport').addEventListener('click', generateDailyReport);
    document.getElementById('regenerateSpecificDate').addEventListener('click', regenerateSpecificDate);
    
    // Apply filters on enter key
    ['startDate', 'endDate'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    });
    
    document.getElementById('userFilter').addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const selectedUser = document.getElementById('userFilter').value;
    
    filteredDailyCommits = allDailyCommits.filter(dc => {
        // Date filter
        if (startDate && dc.date < startDate) return false;
        if (endDate && dc.date > endDate) return false;
        
        // User filter
        if (selectedUser && dc.user !== selectedUser) return false;
        
        return true;
    });
    
    // Sort by date (newest first) and then by user
    filteredDailyCommits.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return a.user.localeCompare(b.user);
    });
    
    displayDailyCommits();
    updateStats();
}

// Reset filters
function resetFilters() {
    setDateDefaults();
    document.getElementById('userFilter').value = '';
    applyFilters();
}

// Display daily commits in table
function displayDailyCommits() {
    const tbody = document.getElementById('dailyCommitsBody');
    
    if (filteredDailyCommits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">No daily commits found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredDailyCommits.map((dc, index) => {
        const statusClass = dc.commitCount > 0 ? 'status-ok' : 'status-no-activity';
        const statusText = dc.commitCount > 0 ? 'OK' : 'No Activity';
        const isClickable = dc.commitCount > 0 && dc.commitIndices && dc.commitIndices.length > 0;
        const cursorStyle = isClickable ? 'cursor: pointer;' : 'cursor: default;';
        
        // Calculate hours difference
        const hoursDiff = calculateHoursDiff(dc.user, dc.totalHours);
        const hoursDiffFormatted = formatHoursDiff(hoursDiff);
        
        return `
            <tr data-dc-index="${index}" style="${cursorStyle}" ${isClickable ? 'class="clickable-row"' : ''}>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>${formatDateForDisplay(dc.date)}</td>
                <td>${dc.user}</td>
                <td>${dc.avgCodeQuality.toFixed(1)}</td>
                <td>${dc.avgComplexity.toFixed(1)}</td>
                <td>${dc.avgDevLevel.toFixed(1)}</td>
                <td>${dc.totalHours.toFixed(2)}</td>
                <td>${hoursDiffFormatted}</td>
                <td>${dc.commitCount}</td>
                <td>${dc.projects.join(', ')}</td>
            </tr>
        `;
    }).join('');
    
    // Add click event listeners to clickable rows
    const clickableRows = tbody.querySelectorAll('.clickable-row');
    clickableRows.forEach(row => {
        row.addEventListener('click', handleRowClick);
    });
}

// Handle row click to show commit details
function handleRowClick(event) {
    const row = event.currentTarget;
    const dcIndex = parseInt(row.dataset.dcIndex);
    const dailyCommit = filteredDailyCommits[dcIndex];
    
    if (dailyCommit && dailyCommit.commitIndices && dailyCommit.commitIndices.length > 0) {
        showCommitModal(dailyCommit);
    }
}

// Show commit details in a modal
function showCommitModal(dailyCommit) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'commit-modal';
    
    const commitLinks = dailyCommit.commitIndices.map((index, i) => {
        const hash = dailyCommit.commitHashes[i];
        const shortHash = hash ? hash.substring(0, 7) : `Commit ${i + 1}`;
        return `<a href="/details.html?index=${index}" class="commit-link">${shortHash}</a>`;
    }).join(', ');
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Commits for ${dailyCommit.user} on ${formatDateForDisplay(dailyCommit.date)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Total Commits:</strong> ${dailyCommit.commitCount}</p>
                <p><strong>Total Hours:</strong> ${dailyCommit.totalHours.toFixed(2)}</p>
                <p><strong>Projects:</strong> ${dailyCommit.projects.join(', ')}</p>
                <p><strong>Average Code Quality:</strong> ${dailyCommit.avgCodeQuality.toFixed(1)}</p>
                <p><strong>Average Complexity:</strong> ${dailyCommit.avgComplexity.toFixed(1)}</p>
                <p><strong>Average Dev Level:</strong> ${dailyCommit.avgDevLevel.toFixed(1)}</p>
                <div class="commit-links">
                    <strong>View Commit Details:</strong><br>
                    ${commitLinks}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Update statistics
function updateStats() {
    const totalDays = new Set(filteredDailyCommits.map(dc => dc.date)).size;
    const activeDays = filteredDailyCommits.filter(dc => dc.commitCount > 0).length;
    const totalUsers = new Set(filteredDailyCommits.map(dc => dc.user)).size;
    
    document.getElementById('totalDays').textContent = totalDays;
    document.getElementById('activeDays').textContent = activeDays;
    document.getElementById('totalUsers').textContent = totalUsers;
}

// Generate daily report
async function generateDailyReport() {
    const button = document.getElementById('generateReport');
    const originalText = button.textContent;
    
    try {
        button.textContent = 'Generating...';
        button.disabled = true;
        
        const response = await fetch('/api/generate-daily-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate report');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`Daily report generated successfully. Processed ${result.daysProcessed} days.`);
            // Reload the data to show new entries
            await loadDailyCommits();
        } else {
            throw new Error(result.error || 'Failed to generate report');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        showError('Failed to generate daily report: ' + error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Regenerate specific date
async function regenerateSpecificDate() {
    const dateInput = document.getElementById('regenerateDate');
    const targetDate = dateInput.value;
    
    if (!targetDate) {
        showError('Please select a date to regenerate');
        return;
    }
    
    const button = document.getElementById('regenerateSpecificDate');
    const originalText = button.textContent;
    
    try {
        button.textContent = 'Regenerating...';
        button.disabled = true;
        
        const response = await fetch('/api/generate-daily-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ date: targetDate })
        });
        
        if (!response.ok) {
            throw new Error('Failed to regenerate report for specific date');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`Daily report regenerated successfully for ${targetDate}. ${result.summariesGenerated} records updated.`);
            // Reload the data to show updated entries
            await loadDailyCommits();
        } else {
            throw new Error(result.error || 'Failed to regenerate report');
        }
    } catch (error) {
        console.error('Error regenerating specific date:', error);
        showError('Failed to regenerate daily report for ' + targetDate + ': ' + error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Show error message
function showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
}

// Show success message
function showSuccess(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
}

// Add styles to match the platform's dark theme
const style = document.createElement('style');
style.textContent = `
    .status {
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .status-ok {
        background-color: rgba(40, 167, 69, 0.2);
        color: var(--success-color);
        border: 1px solid var(--success-color);
    }
    
    .status-no-activity {
        background-color: rgba(220, 53, 69, 0.2);
        color: var(--error-color);
        border: 1px solid var(--error-color);
    }
    
    .no-data {
        text-align: center;
        color: var(--text-secondary);
        padding: 40px;
    }
    
    .alert {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    }
    
    .alert-error {
        background-color: rgba(220, 53, 69, 0.2);
        color: var(--error-color);
        border: 1px solid var(--error-color);
    }
    
    .alert-success {
        background-color: rgba(40, 167, 69, 0.2);
        color: var(--success-color);
        border: 1px solid var(--success-color);
    }
    
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
    
    .filters-section {
        background: var(--bg-secondary);
        padding: 20px;
        border: 1px solid var(--border-color);
        margin-bottom: 25px;
    }
    
    .filters-container {
        display: flex;
        gap: 15px;
        align-items: end;
        flex-wrap: wrap;
    }
    
    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .filter-group label {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .filter-input, .filter-select {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-size: 14px;
        background-color: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .filter-input:focus, .filter-select:focus {
        outline: none;
        border-color: var(--accent-green);
    }
    
    .actions-section {
        margin-bottom: 20px;
    }
    
    .summary-stats-section {
        margin-bottom: 20px;
    }
    
    .summary-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
    }
    
    .stat-card {
        background: var(--bg-secondary);
        padding: 20px;
        border: 1px solid var(--border-color);
        text-align: center;
    }
    
    .stat-card h3 {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0 0 10px 0;
        font-weight: normal;
        text-transform: uppercase;
    }
    
    .stat-card p {
        font-size: 32px;
        font-weight: bold;
        color: var(--accent-green);
        margin: 0;
    }
    
    .table-section {
        background: var(--bg-secondary);
        padding: 20px;
        border: 1px solid var(--border-color);
        margin-bottom: 25px;
    }
    
    .table-section h3 {
        color: var(--accent-green);
        margin-bottom: 20px;
        font-size: 1.2rem;
        font-weight: normal;
    }
    
    .table-wrapper {
        overflow-x: auto;
    }
    
    #dailyCommitsTable {
        width: 100%;
        border-collapse: collapse;
    }
    
    #dailyCommitsTable th,
    #dailyCommitsTable td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    
    #dailyCommitsTable th {
        background-color: var(--bg-primary);
        font-weight: 600;
        color: var(--text-primary);
        position: sticky;
        top: 0;
        z-index: 10;
    }
    
    #dailyCommitsTable tbody tr {
        background: var(--bg-secondary);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    #dailyCommitsTable tbody tr:hover {
        background-color: var(--hover-bg);
    }
    
    .btn-primary {
        background-color: var(--accent-green);
        color: var(--bg-primary);
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: opacity 0.2s;
    }
    
    .btn-primary:hover {
        opacity: 0.8;
    }
    
    .btn-primary:disabled {
        background-color: var(--text-secondary);
        cursor: not-allowed;
        opacity: 0.5;
    }
    
    .btn-secondary {
        background-color: transparent;
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: border-color 0.2s, color 0.2s;
    }
    
    .btn-secondary:hover {
        border-color: var(--accent-green);
        color: var(--accent-green);
    }
    
    /* Modal Styles */
    .commit-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
    }
    
    .modal-header {
        padding: 20px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .modal-header h3 {
        color: var(--accent-green);
        margin: 0;
        font-size: 1.2rem;
        font-weight: normal;
    }
    
    .modal-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
    }
    
    .modal-close:hover {
        color: var(--accent-green);
    }
    
    .modal-body {
        padding: 20px;
    }
    
    .modal-body p {
        margin: 10px 0;
        color: var(--text-primary);
    }
    
    .modal-body strong {
        color: var(--text-primary);
    }
    
    .commit-links {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid var(--border-color);
    }
    
    .commit-link {
        color: var(--accent-green);
        text-decoration: none;
        font-family: monospace;
        font-size: 14px;
        margin-right: 10px;
        padding: 4px 8px;
        border: 1px solid var(--border-color);
        border-radius: 3px;
        transition: all 0.2s;
        display: inline-block;
        margin-bottom: 5px;
    }
    
    .commit-link:hover {
        background-color: var(--hover-bg);
        border-color: var(--accent-green);
    }
    
    /* Clickable row styling */
    .clickable-row:hover {
        background-color: var(--hover-bg) !important;
    }
`;
document.head.appendChild(style);