// Global variables for pagination
let allCommits = [];
const pagination = {
    comprehensive: { currentPage: 1, pageSize: 25, filteredData: [] },
    basic: { currentPage: 1, pageSize: 25, filteredData: [] },
    scores: { currentPage: 1, pageSize: 25, filteredData: [] },
    cost: { currentPage: 1, pageSize: 25, filteredData: [] }
};

// Fetch and display commit history
async function loadCommitHistory() {
    try {
        const response = await fetch('/api/commits');
        allCommits = await response.json();
        
        // Initialize filtered data
        pagination.comprehensive.filteredData = [...allCommits];
        pagination.basic.filteredData = [...allCommits];
        pagination.scores.filteredData = [...allCommits];
        pagination.cost.filteredData = [...allCommits];
        
        displayComprehensive();
        displayBasicInfo();
        displayScores();
        displayCosts();
        
        setupPagination();
    } catch (error) {
        console.error('Error loading commits:', error);
    }
}

// Display basic information table
function displayBasicInfo() {
    const tbody = document.getElementById('basicInfoBody');
    tbody.innerHTML = '';
    
    const pageData = getPaginatedData('basic');
    
    pageData.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const globalIndex = allCommits.indexOf(commit);
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${commit.commitHash.substring(0, 8)}</td>
            <td>${commit.user}</td>
            <td>${commit.project}</td>
            <td>${commit.fileChanges || 0}</td>
            <td>+${commit.linesAdded || 0}</td>
            <td>-${commit.linesDeleted || 0}</td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 40)}</td>
            <td>
                <button class="view-details" onclick="viewDetails(${globalIndex})">
                    View Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updatePaginationInfo('basic');
}

// Display analysis scores table
function displayScores() {
    const tbody = document.getElementById('scoresBody');
    tbody.innerHTML = '';
    
    const pageData = getPaginatedData('scores');
    
    pageData.forEach(commit => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const devLevel = getDevLevel(commit.averageDevLevel);
        const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
        const savingsPercent = ((savings / commit.averageEstimatedHours) * 100).toFixed(0);
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${commit.averageEstimatedHours.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>${(commit.averageEstimatedHoursWithAi || 0).toFixed(1)}</td>
            <td>${savings.toFixed(1)}h (${savingsPercent}%)</td>
        `;
        
        tbody.appendChild(row);
    });
    
    updatePaginationInfo('scores');
}

// Display cost analysis table
function displayCosts() {
    const tbody = document.getElementById('costBody');
    tbody.innerHTML = '';
    
    const pageData = getPaginatedData('cost');
    
    let grandTotalTokens = 0;
    let grandTotalCost = 0;
    
    // Calculate grand totals from all filtered data, not just current page
    pagination.cost.filteredData.forEach(commit => {
        grandTotalTokens += commit.totalTokens || 0;
        grandTotalCost += commit.totalCost || 0;
    });
    
    // Display current page data
    pageData.forEach(commit => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const tokens = commit.totalTokens || 0;
        const cost = commit.totalCost || 0;
        const avgCost = commit.avgCostPerModel || 0;
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${tokens.toLocaleString()}</td>
            <td>$${cost.toFixed(4)}</td>
            <td>$${avgCost.toFixed(4)}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update grand totals
    document.getElementById('totalTokens').textContent = grandTotalTokens.toLocaleString();
    document.getElementById('totalCost').textContent = `$${grandTotalCost.toFixed(4)}`;
    const avgCost = pagination.cost.filteredData.length > 0 ? grandTotalCost / pagination.cost.filteredData.length : 0;
    document.getElementById('avgCost').textContent = `$${avgCost.toFixed(4)}`;
    
    updatePaginationInfo('cost');
}

// Display comprehensive table with all data
function displayComprehensive() {
    const tbody = document.getElementById('comprehensiveBody');
    tbody.innerHTML = '';
    
    const pageData = getPaginatedData('comprehensive');
    
    pageData.forEach((commit, index) => {
        const row = document.createElement('tr');
        const date = new Date(commit.timestamp).toLocaleDateString();
        const devLevel = getDevLevel(commit.averageDevLevel);
        const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
        const savingsPercent = ((savings / commit.averageEstimatedHours) * 100).toFixed(0);
        const tokens = commit.totalTokens || 0;
        const cost = commit.totalCost || 0;
        const avgCost = commit.avgCostPerModel || 0;
        const globalIndex = allCommits.indexOf(commit);
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${commit.commitHash.substring(0, 8)}</td>
            <td>${commit.user}</td>
            <td>${commit.project}</td>
            <td>${commit.fileChanges || 0}</td>
            <td>+${commit.linesAdded || 0}</td>
            <td>-${commit.linesDeleted || 0}</td>
            <td title="${commit.commitMessage}">${truncate(commit.commitMessage, 40)}</td>
            <td>${commit.averageCodeQuality.toFixed(1)}</td>
            <td>${commit.averageDevLevel.toFixed(1)} (${devLevel})</td>
            <td>${commit.averageComplexity.toFixed(1)}</td>
            <td>${commit.averageEstimatedHours.toFixed(1)}</td>
            <td>${(commit.averageAiPercentage || 0).toFixed(0)}%</td>
            <td>${(commit.averageEstimatedHoursWithAi || 0).toFixed(1)}</td>
            <td>${savings.toFixed(1)}h (${savingsPercent}%)</td>
            <td>${tokens.toLocaleString()}</td>
            <td>$${cost.toFixed(4)}</td>
            <td>$${avgCost.toFixed(4)}</td>
            <td>
                <button class="view-details" onclick="viewDetails(${globalIndex})">
                    View Details
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updatePaginationInfo('comprehensive');
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

function viewDetails(index) {
    window.location.href = `/details.html?index=${index}`;
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadCommitHistory();
    setupSearchFunctionality();
});

// Search functionality
function setupSearchFunctionality() {
    // Setup search for each table
    setupTableSearch('basicSearch', 'basicInfoBody');
    setupTableSearch('scoresSearch', 'scoresBody');
    setupTableSearch('costSearch', 'costBody');
    setupTableSearch('comprehensiveSearch', 'comprehensiveBody');
}

function setupTableSearch(searchInputId, tableBodyId) {
    const searchInput = document.getElementById(searchInputId);
    const tableBody = document.getElementById(tableBodyId);
    
    if (!searchInput || !tableBody) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = tableBody.getElementsByTagName('tr');
        
        Array.from(rows).forEach(row => {
            // Skip the grand total row in cost table
            if (row.id === 'grandTotal') return;
            
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
        
        // Update grand total if it's the cost table
        if (tableBodyId === 'costBody') {
            updateGrandTotal();
        }
    });
}

// Update grand total for cost table when filtering
function updateGrandTotal() {
    const tbody = document.getElementById('costBody');
    const rows = tbody.getElementsByTagName('tr');
    let totalTokens = 0;
    let totalCost = 0;
    let visibleRows = 0;
    
    Array.from(rows).forEach(row => {
        if (row.style.display !== 'none') {
            const tokens = parseInt(row.cells[1].textContent) || 0;
            const cost = parseFloat(row.cells[2].textContent.replace('$', '')) || 0;
            totalTokens += tokens;
            totalCost += cost;
            visibleRows++;
        }
    });
    
    document.getElementById('totalTokens').textContent = totalTokens.toLocaleString();
    document.getElementById('totalCost').textContent = `$${totalCost.toFixed(4)}`;
    document.getElementById('avgCost').textContent = visibleRows > 0 ? `$${(totalCost / visibleRows).toFixed(4)}` : '$0.0000';
}

// Pagination Functions
function getPaginatedData(tableType) {
    const pag = pagination[tableType];
    const startIndex = (pag.currentPage - 1) * pag.pageSize;
    const endIndex = startIndex + pag.pageSize;
    return pag.filteredData.slice(startIndex, endIndex);
}

function getTotalPages(tableType) {
    const pag = pagination[tableType];
    return Math.ceil(pag.filteredData.length / pag.pageSize);
}

function updatePaginationInfo(tableType) {
    const pag = pagination[tableType];
    const totalPages = getTotalPages(tableType);
    const pageInfo = document.getElementById(`${tableType}PageInfo`);
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${pag.currentPage} of ${totalPages}`;
    }
    
    // Update button states
    const firstBtn = document.getElementById(`${tableType}FirstPage`);
    const prevBtn = document.getElementById(`${tableType}PrevPage`);
    const nextBtn = document.getElementById(`${tableType}NextPage`);
    const lastBtn = document.getElementById(`${tableType}LastPage`);
    
    if (firstBtn) firstBtn.disabled = pag.currentPage === 1;
    if (prevBtn) prevBtn.disabled = pag.currentPage === 1;
    if (nextBtn) nextBtn.disabled = pag.currentPage === totalPages || totalPages === 0;
    if (lastBtn) lastBtn.disabled = pag.currentPage === totalPages || totalPages === 0;
}

function changePage(tableType, page) {
    const pag = pagination[tableType];
    const totalPages = getTotalPages(tableType);
    
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    pag.currentPage = page;
    
    // Refresh the appropriate table
    switch (tableType) {
        case 'comprehensive':
            displayComprehensive();
            break;
        case 'basic':
            displayBasicInfo();
            break;
        case 'scores':
            displayScores();
            break;
        case 'cost':
            displayCosts();
            break;
    }
}

function changePageSize(tableType, newSize) {
    const pag = pagination[tableType];
    pag.pageSize = parseInt(newSize);
    pag.currentPage = 1; // Reset to first page
    changePage(tableType, 1);
}

function setupPagination() {
    const tableTypes = ['comprehensive', 'basic', 'scores', 'cost'];
    
    tableTypes.forEach(tableType => {
        // First page button
        const firstBtn = document.getElementById(`${tableType}FirstPage`);
        if (firstBtn) {
            firstBtn.addEventListener('click', () => changePage(tableType, 1));
        }
        
        // Previous page button
        const prevBtn = document.getElementById(`${tableType}PrevPage`);
        if (prevBtn) {
            prevBtn.addEventListener('click', () => changePage(tableType, pagination[tableType].currentPage - 1));
        }
        
        // Next page button
        const nextBtn = document.getElementById(`${tableType}NextPage`);
        if (nextBtn) {
            nextBtn.addEventListener('click', () => changePage(tableType, pagination[tableType].currentPage + 1));
        }
        
        // Last page button
        const lastBtn = document.getElementById(`${tableType}LastPage`);
        if (lastBtn) {
            lastBtn.addEventListener('click', () => changePage(tableType, getTotalPages(tableType)));
        }
        
        // Page size selector
        const sizeSelect = document.getElementById(`${tableType}PageSize`);
        if (sizeSelect) {
            sizeSelect.addEventListener('change', (e) => changePageSize(tableType, e.target.value));
        }
    });
    
    // Update search functionality to work with pagination
    setupPaginatedSearch();
}

function setupPaginatedSearch() {
    const searchConfigs = [
        { inputId: 'comprehensiveSearch', tableType: 'comprehensive' },
        { inputId: 'basicSearch', tableType: 'basic' },
        { inputId: 'scoresSearch', tableType: 'scores' },
        { inputId: 'costSearch', tableType: 'cost' }
    ];
    
    searchConfigs.forEach(config => {
        const searchInput = document.getElementById(config.inputId);
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                filterTableData(config.tableType, this.value.toLowerCase());
            });
        }
    });
}

function filterTableData(tableType, searchTerm) {
    const pag = pagination[tableType];
    
    if (searchTerm === '') {
        pag.filteredData = [...allCommits];
    } else {
        pag.filteredData = allCommits.filter(commit => {
            const searchableText = [
                commit.commitMessage,
                commit.user,
                commit.project,
                commit.commitHash,
                new Date(commit.timestamp).toLocaleDateString()
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
    }
    
    pag.currentPage = 1; // Reset to first page after search
    changePage(tableType, 1);
}