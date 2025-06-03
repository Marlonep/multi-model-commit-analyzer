// Get commit index from URL
const urlParams = new URLSearchParams(window.location.search);
const commitIndex = urlParams.get('index');
let githubConfig = null;

// Fetch GitHub configuration
async function loadGithubConfig() {
    try {
        const response = await fetch('/api/github-config');
        githubConfig = await response.json();
    } catch (error) {
        console.error('Error loading GitHub config:', error);
        // Fallback configuration
        githubConfig = {
            username: 'Marlonep',
            repository: 'multi-model-commit-analyzer',
            baseUrl: 'https://github.com/Marlonep/multi-model-commit-analyzer'
        };
    }
}

// Load and display commit details
async function loadCommitDetails() {
    if (commitIndex === null) {
        window.location.href = '/';
        return;
    }
    
    try {
        // Load GitHub config first
        await loadGithubConfig();
        
        const response = await fetch(`/api/commits/${commitIndex}`);
        if (!response.ok) {
            throw new Error('Commit not found');
        }
        
        const commit = await response.json();
        displayCommitDetails(commit);
    } catch (error) {
        console.error('Error loading commit details:', error);
        alert('Error loading commit details');
        window.location.href = '/';
    }
}

// Display all commit details
function displayCommitDetails(commit) {
    // Commit info
    const shortHash = commit.commitHash.substring(0, 8);
    document.getElementById('commitHash').textContent = shortHash;
    document.getElementById('commitMessage').textContent = commit.commitMessage;
    document.getElementById('commitUser').textContent = commit.user;
    document.getElementById('commitProject').textContent = commit.project;
    document.getElementById('commitTimestamp').textContent = new Date(commit.timestamp).toLocaleString();
    document.getElementById('commitChanges').textContent = 
        `${commit.fileChanges} files, +${commit.linesAdded} -${commit.linesDeleted}`;
    
    // Set GitHub links using actual repository configuration
    const githubUsername = githubConfig?.username || 'Marlonep';
    const projectName = githubConfig?.repository || 'multi-model-commit-analyzer';
    
    // GitHub commit link
    document.getElementById('commitHashLink').href = 
        `https://github.com/${githubUsername}/${projectName}/commit/${commit.commitHash}`;
    
    // GitHub user profile link
    document.getElementById('commitUserLink').href = 
        `https://github.com/${githubUsername}`;
    
    // GitHub project repository link
    document.getElementById('commitProjectLink').href = 
        `https://github.com/${githubUsername}/${projectName}`;
    
    // Average scores
    document.getElementById('avgQuality').textContent = commit.averageCodeQuality.toFixed(1);
    document.getElementById('avgDevLevel').textContent = 
        `${commit.averageDevLevel.toFixed(1)}`;
    document.getElementById('avgComplexity').textContent = commit.averageComplexity.toFixed(1);
    document.getElementById('avgHours').textContent = commit.averageEstimatedHours.toFixed(1);
    document.getElementById('avgAiPercent').textContent = 
        `${(commit.averageAiPercentage || 0).toFixed(0)}%`;
    
    // Time savings
    const savings = commit.averageEstimatedHours - (commit.averageEstimatedHoursWithAi || 0);
    document.getElementById('timeSavings').textContent = 
        `${savings.toFixed(1)}h`;
    
    // Cost summary
    document.getElementById('totalTokens').textContent = 
        (commit.totalTokens || 0).toLocaleString();
    document.getElementById('totalCost').textContent = 
        `$${(commit.totalCost || 0).toFixed(4)}`;
    document.getElementById('avgModelCost').textContent = 
        `$${(commit.avgCostPerModel || 0).toFixed(4)}`;
    
    // Code analysis
    if (commit.codeAnalysis) {
        const ca = commit.codeAnalysis;
        document.getElementById('totalLines').textContent = 
            ca.totalLines.toLocaleString();
        
        // Update legend values
        document.getElementById('codePercent').textContent = `${ca.codePercent}%`;
        document.getElementById('codeLines').textContent = `${ca.codeLines.toLocaleString()} lines`;
        document.getElementById('commentPercent').textContent = `${ca.commentPercent}%`;
        document.getElementById('commentLines').textContent = `${ca.commentLines.toLocaleString()} lines`;
        document.getElementById('textPercent').textContent = `${ca.textPercent}%`;
        document.getElementById('textLines').textContent = `${ca.textLines.toLocaleString()} lines`;
        
        // Update stacked progress bar segments
        document.getElementById('codeBar').style.width = `${ca.codePercent}%`;
        document.getElementById('commentBar').style.width = `${ca.commentPercent}%`;
        document.getElementById('textBar').style.width = `${ca.textPercent}%`;
    } else {
        // Hide code analysis section if no data
        const codeSection = document.querySelector('.code-analysis');
        if (codeSection) {
            codeSection.style.display = 'none';
            const sectionTitle = codeSection.previousElementSibling;
            if (sectionTitle && sectionTitle.classList.contains('section-title')) {
                sectionTitle.style.display = 'none';
            }
        }
    }
    
    // Model cards
    displayModelCards(commit.modelScores);
    
    // Status history
    displayStatusHistory(commit);
}

// Display individual model analysis cards
function displayModelCards(modelScores) {
    const container = document.getElementById('modelCards');
    container.innerHTML = '';
    
    // Calculate badges for comparisons
    const badges = calculateModelBadges(modelScores);
    
    modelScores.forEach(score => {
        const card = document.createElement('div');
        card.className = 'model-card';
        
        const devLevel = getDevLevel(score.devLevel);
        const modelBadges = badges[score.modelName] || [];
        
        card.innerHTML = `
            <div class="model-header">
                <div>
                    <div class="model-name">${score.modelName}</div>
                    <div class="model-provider">${score.provider}</div>
                    <div class="model-badges">${modelBadges.map(badge => `<span class="model-badge ${badge.type}">${badge.text}</span>`).join('')}</div>
                </div>
            </div>
            
            <div class="model-scores">
                <div class="score-item">
                    <span>Code Quality:</span>
                    <span>${score.codeQuality.toFixed(1)}/5</span>
                </div>
                <div class="score-item">
                    <span>Developer Level:</span>
                    <span>${score.devLevel.toFixed(1)} (${devLevel})</span>
                </div>
                <div class="score-item">
                    <span>Complexity:</span>
                    <span>${score.complexity.toFixed(1)}/5</span>
                </div>
                <div class="score-item">
                    <span>Estimated Hours:</span>
                    <span>${score.estimatedHours.toFixed(1)}</span>
                </div>
                <div class="score-item">
                    <span>AI Percentage:</span>
                    <span>${(score.aiPercentage || 0).toFixed(0)}%</span>
                </div>
                <div class="score-item">
                    <span>Hours with AI:</span>
                    <span>${(score.estimatedHoursWithAi || 0).toFixed(1)}</span>
                </div>
            </div>
            
            <div class="cost-info">
                <span>Tokens: ${(score.tokensUsed || 0).toLocaleString()}</span>
                <span>Token Price: $${getTokenPrice(score.modelName, score.tokensUsed || 0)}</span>
                <span>Total Cost: $${(score.cost || 0).toFixed(4)}</span>
                <span>Time: ${score.responseTime.toFixed(2)}s</span>
            </div>
            
            <div class="reasoning"><strong>Reasoning:</strong>${sanitizeReasoning(score.reasoning)}</div>
        `;
        
        container.appendChild(card);
    });
}

// Display status history
function displayStatusHistory(commit) {
    const container = document.getElementById('statusHistory');
    
    // Current status
    const currentStatus = commit.status || 'ok';
    const statusBadge = `<span class="status-badge status-${currentStatus}">${currentStatus.toUpperCase()}</span>`;
    
    if (!commit.statusLog || commit.statusLog.length === 0) {
        container.innerHTML = `
            <div class="status-history-item">
                <p>Current Status: ${statusBadge}</p>
                <p class="no-history">No status changes recorded</p>
            </div>
        `;
        return;
    }
    
    // Display current status and history
    let html = `
        <div class="status-history-item current-status">
            <p>Current Status: ${statusBadge}</p>
        </div>
        <h4>Change History:</h4>
        <div class="status-timeline">
    `;
    
    // Display history in reverse chronological order
    const sortedHistory = [...commit.statusLog].reverse();
    
    sortedHistory.forEach((change, index) => {
        const date = new Date(change.timestamp);
        const formattedDate = date.toLocaleString();
        
        html += `
            <div class="status-change-item">
                <div class="status-change-header">
                    <span class="status-change-date">${formattedDate}</span>
                    <span class="status-change-user">by ${change.changedBy}</span>
                </div>
                <div class="status-change-details">
                    <span class="status-badge status-${change.previousStatus}">${change.previousStatus.toUpperCase()}</span>
                    <span class="status-arrow">→</span>
                    <span class="status-badge status-${change.newStatus}">${change.newStatus.toUpperCase()}</span>
                </div>
                <div class="status-change-reason">${change.reason}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Helper functions
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

function calculateModelBadges(modelScores) {
    if (!modelScores || modelScores.length === 0) return {};
    
    const badges = {};
    
    // Initialize badges for each model
    modelScores.forEach(score => {
        badges[score.modelName] = [];
    });
    
    // Filter out models with 0 cost or 0 time (error states)
    const validScores = modelScores.filter(score => score.cost > 0 && score.responseTime > 0);
    
    if (validScores.length === 0) return badges;
    
    // Find extremes
    const costs = validScores.map(s => s.cost);
    const times = validScores.map(s => s.responseTime);
    
    const maxCost = Math.max(...costs);
    const minCost = Math.min(...costs);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    // Assign badges (can be multiple models with same extreme values)
    validScores.forEach(score => {
        const modelBadges = badges[score.modelName];
        
        // Cost badges
        if (score.cost === maxCost) {
            modelBadges.push({ type: 'most-expensive', text: '💰 Most Expensive' });
        }
        if (score.cost === minCost) {
            modelBadges.push({ type: 'cheapest', text: '💸 Cheapest' });
        }
        
        // Speed badges  
        if (score.responseTime === maxTime) {
            modelBadges.push({ type: 'slowest', text: '🐌 Slowest' });
        }
        if (score.responseTime === minTime) {
            modelBadges.push({ type: 'fastest', text: '⚡ Fastest' });
        }
    });
    
    return badges;
}

function getTokenPrice(modelName, tokens) {
    // Model pricing per 1K tokens (based on the pricing from analyzeCommit.js)
    const MODEL_PRICING = {
        'GPT-4': {
            input: 0.030,   // $30 per 1M input tokens
            output: 0.060   // $60 per 1M output tokens
        },
        'Claude Sonnet 4': {
            input: 0.003,   // $3 per 1M input tokens
            output: 0.015   // $15 per 1M output tokens
        },
        'Gemini 2.5 Flash Preview': {
            input: 0.000075, // $0.075 per 1M input tokens
            output: 0.00030  // $0.30 per 1M output tokens
        },
        'Grok 3': {
            input: 0.005,   // $5 per 1M input tokens
            output: 0.015   // $15 per 1M output tokens
        }
    };
    
    const pricing = MODEL_PRICING[modelName];
    if (!pricing || tokens === 0) {
        return '0.0000';
    }
    
    // Estimate that about 70% are input tokens, 30% are output tokens
    const inputTokens = Math.floor(tokens * 0.7);
    const outputTokens = Math.floor(tokens * 0.3);
    
    // Calculate cost: (tokens / 1000) * price_per_1k_tokens
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    return totalCost.toFixed(4);
}

function sanitizeReasoning(reasoning) {
    if (!reasoning) return ' No reasoning provided';
    
    // Check if it's an error message
    if (reasoning.startsWith('Error:')) {
        // Hide API keys in error messages
        let sanitized = reasoning.replace(/sk-[a-zA-Z0-9\*]+/g, 'sk-***[HIDDEN]***');
        
        // Truncate very long error messages
        if (sanitized.length > 300) {
            sanitized = sanitized.substring(0, 297) + '...';
        }
        
        return ` <span class="error-text">${sanitized}</span>`;
    }
    
    // For regular reasoning, add single space and return
    return ` ${reasoning}`;
}

// Load details when page loads
document.addEventListener('DOMContentLoaded', loadCommitDetails);