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
        document.getElementById('codeLines').textContent = ca.codeLines.toLocaleString();
        document.getElementById('commentPercent').textContent = `${ca.commentPercent}%`;
        document.getElementById('commentLines').textContent = ca.commentLines.toLocaleString();
        document.getElementById('textPercent').textContent = `${ca.textPercent}%`;
        document.getElementById('textLines').textContent = ca.textLines.toLocaleString();
        
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
}

// Display individual model analysis cards
function displayModelCards(modelScores) {
    const container = document.getElementById('modelCards');
    container.innerHTML = '';
    
    modelScores.forEach(score => {
        const card = document.createElement('div');
        card.className = 'model-card';
        
        const devLevel = getDevLevel(score.devLevel);
        
        card.innerHTML = `
            <div class="model-header">
                <div>
                    <div class="model-name">${score.modelName}</div>
                    <div class="model-provider">${score.provider}</div>
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
                <span>Cost: $${(score.cost || 0).toFixed(4)}</span>
                <span>Time: ${score.responseTime.toFixed(2)}s</span>
            </div>
            
            <div class="reasoning">
                <strong>Reasoning:</strong><br>
                ${score.reasoning}
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Helper function
function getDevLevel(level) {
    if (level <= 1.5) return 'Jr';
    if (level <= 2.5) return 'Mid';
    return 'Sr';
}

// Load details when page loads
document.addEventListener('DOMContentLoaded', loadCommitDetails);