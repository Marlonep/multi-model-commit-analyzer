// AI Models Configuration and Management

// Check if user has permission to manage models
function checkModelsAccess() {
    if (!isAdmin()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

let allCommits = [];

class ModelsManager {
    constructor() {
        // Check permissions first
        if (!checkModelsAccess()) {
            return;
        }
        this.models = [];
        this.performanceData = {};
        this.loadModelsConfiguration();
        this.init();
    }

    loadModelsConfiguration() {
        // Define all available models and their configurations
        this.models = [
            {
                provider: 'OpenAI',
                modelName: 'o3-mini',
                modelId: 'o3-mini',
                status: 'active',
                inputCost: '$60/1M tokens',
                outputCost: '$240/1M tokens',
                apiEndpoint: 'https://api.openai.com/v1',
                parameters: {
                    max_completion_tokens: 500,
                    // temperature not supported
                },
                envVar: 'OPENAI_API_KEY',
                type: 'openai',
                notes: 'Enhanced reasoning, no temperature support'
            },
            {
                provider: 'OpenAI',
                modelName: 'GPT-4',
                modelId: 'gpt-4',
                status: 'inactive',
                inputCost: '$30/1M tokens',
                outputCost: '$60/1M tokens',
                apiEndpoint: 'https://api.openai.com/v1',
                parameters: {
                    max_tokens: 500,
                    temperature: 0.3
                },
                envVar: 'OPENAI_API_KEY',
                type: 'openai',
                notes: 'Previous model, replaced by o3-mini'
            },
            {
                provider: 'Anthropic',
                modelName: 'Claude Sonnet 4',
                modelId: 'claude-sonnet-4-20250514',
                status: 'active',
                inputCost: '$3/1M tokens',
                outputCost: '$15/1M tokens',
                apiEndpoint: 'Anthropic API',
                parameters: {
                    max_tokens: 500,
                    temperature: 0.3
                },
                envVar: 'CLAUDE_API_KEY',
                type: 'claude',
                notes: 'High quality analysis, good value'
            },
            {
                provider: 'Google',
                modelName: 'Gemini 2.5 Flash Preview',
                modelId: 'gemini-2.5-flash-preview-04-17',
                status: 'active',
                inputCost: '$0.075/1M tokens',
                outputCost: '$0.30/1M tokens',
                apiEndpoint: 'https://generativelanguage.googleapis.com',
                parameters: {
                    // No explicit parameters
                },
                envVar: 'GEMINI_API_KEY',
                type: 'gemini',
                notes: 'Lowest cost option'
            },
            {
                provider: 'xAI',
                modelName: 'Grok 3',
                modelId: 'grok-3',
                status: 'active',
                inputCost: '$5/1M tokens',
                outputCost: '$15/1M tokens',
                apiEndpoint: 'https://api.x.ai/v1',
                parameters: {
                    max_tokens: 500,
                    temperature: 0.3
                },
                envVar: 'GROK_API_KEY',
                type: 'grok',
                notes: 'Alternative perspective analysis'
            }
        ];
    }

    async init() {
        this.renderModelsTable();
        this.loadPerformanceData();
        this.renderPerformanceTable();
        this.updateStats();
        this.bindEvents();
        this.populateModelSelector();
        await this.loadCommitsData();
        this.calculateCostSummary(allCommits);
        this.displayAnalysisPrompt();
    }

    renderModelsTable() {
        const tbody = document.getElementById('modelsTableBody');
        tbody.innerHTML = '';

        this.models.forEach(model => {
            const row = document.createElement('tr');
            row.className = `model-row model-${model.status}`;
            
            const parametersStr = Object.entries(model.parameters)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ') || 'Default';

            row.innerHTML = `
                <td><span class="provider-badge ${model.provider.toLowerCase()}">${model.provider}</span></td>
                <td><strong>${model.modelName}</strong></td>
                <td><code>${model.modelId}</code></td>
                <td><span class="status-badge status-${model.status}">${model.status.toUpperCase()}</span></td>
                <td>${model.inputCost}</td>
                <td>${model.outputCost}</td>
                <td>${model.apiEndpoint}</td>
                <td><small>${parametersStr}</small></td>
                <td>${this.getLastUsed(model.modelId)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn small secondary test-model" data-model="${model.modelId}">Test</button>
                        <button class="btn small secondary toggle-model" data-model="${model.modelId}">
                            ${model.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    formatStatus(status) {
        const statusMap = {
            'active': '✅ Active',
            'inactive': '❌ Inactive', 
            'error': '⚠️ Error',
            'unknown': '❓ Unknown'
        };
        return statusMap[status] || status;
    }

    getLastUsed(modelId) {
        // This would typically come from the commit analysis history
        // For now, return placeholder data
        const dates = {
            'o3-mini': '2025-05-30',
            'claude-sonnet-4-20250514': '2025-05-30',
            'gemini-2.5-flash-preview-04-17': '2025-05-30',
            'grok-3': '2025-05-30'
        };
        return dates[modelId] || 'Never';
    }

    loadPerformanceData() {
        // This would typically load from commit_analysis_history.json
        // For now, use sample data based on recent analysis
        this.performanceData = {
            'o3-mini': {
                avgQuality: 3.0,
                avgResponseTime: 7.8,
                totalTokens: 1175,
                totalCost: 0.0000,
                successRate: 50,
                errorRate: 50,
                lastError: 'JSON parsing error'
            },
            'claude-sonnet-4-20250514': {
                avgQuality: 4.2,
                avgResponseTime: 5.9,
                totalTokens: 964,
                totalCost: 0.0049,
                successRate: 100,
                errorRate: 0,
                lastError: 'None'
            },
            'gemini-2.5-flash-preview-04-17': {
                avgQuality: 4.2,
                avgResponseTime: 10.5,
                totalTokens: 795,
                totalCost: 0.0001,
                successRate: 100,
                errorRate: 0,
                lastError: 'None'
            },
            'grok-3': {
                avgQuality: 3.8,
                avgResponseTime: 2.8,
                totalTokens: 840,
                totalCost: 0.0060,
                successRate: 100,
                errorRate: 0,
                lastError: 'None'
            }
        };
    }

    renderPerformanceTable() {
        const tbody = document.getElementById('performanceTableBody');
        tbody.innerHTML = '';

        Object.entries(this.performanceData).forEach(([modelId, data]) => {
            const model = this.models.find(m => m.modelId === modelId);
            if (!model) return;

            const row = document.createElement('tr');
            // Determine performance status based on success rate
            const performanceStatus = data.successRate === 100 ? 'excellent' : 
                                    data.successRate >= 80 ? 'good' :
                                    data.successRate >= 50 ? 'warning' : 'poor';
            row.className = `performance-row performance-${performanceStatus}`;
            
            row.innerHTML = `
                <td><strong>${model.modelName}</strong></td>
                <td><span class="quality-score quality-${Math.floor(data.avgQuality)}">${data.avgQuality.toFixed(1)}/5</span></td>
                <td>${data.avgResponseTime.toFixed(1)}s</td>
                <td>${data.totalTokens.toLocaleString()}</td>
                <td>$${data.totalCost.toFixed(4)}</td>
                <td><span class="status-badge status-${data.successRate === 100 ? 'success' : data.successRate >= 50 ? 'warning' : 'error'}">${data.successRate}%</span></td>
                <td><span class="status-badge status-${data.errorRate === 0 ? 'success' : data.errorRate <= 20 ? 'warning' : 'error'}">${data.errorRate}%</span></td>
                <td><small class="${data.lastError !== 'None' ? 'error-text' : ''}">${data.lastError}</small></td>
            `;
            tbody.appendChild(row);
        });
    }

    updateStats() {
        const activeModels = this.models.filter(m => m.status === 'active').length;
        const inactiveModels = this.models.length - activeModels;
        
        // Calculate totals from performance data
        const totalCost = Object.values(this.performanceData)
            .reduce((sum, data) => sum + data.totalCost, 0);
        
        const avgResponseTime = Object.values(this.performanceData)
            .reduce((sum, data) => sum + data.avgResponseTime, 0) / 
            Object.keys(this.performanceData).length;

        document.getElementById('activeModels').textContent = activeModels;
        document.getElementById('inactiveModels').textContent = inactiveModels;
        document.getElementById('totalCost').textContent = `$${totalCost.toFixed(4)}`;
        document.getElementById('avgResponseTime').textContent = `${avgResponseTime.toFixed(1)}s`;
    }

    populateModelSelector() {
        const selector = document.getElementById('modelSelector');
        selector.innerHTML = '<option value="">Select model to test individually</option>';
        
        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.modelId;
            option.textContent = `${model.provider} - ${model.modelName}`;
            selector.appendChild(option);
        });
    }

    bindEvents() {
        // Test all models button
        document.getElementById('testAllModels').addEventListener('click', () => {
            this.testAllModels();
        });

        // Refresh status button
        document.getElementById('refreshStatus').addEventListener('click', () => {
            this.refreshModelStatus();
        });

        // Test single model button
        document.getElementById('testSingleModel').addEventListener('click', () => {
            const selectedModel = document.getElementById('modelSelector').value;
            if (selectedModel) {
                this.testSingleModel(selectedModel);
            } else {
                alert('Please select a model to test');
            }
        });

        // Individual test buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('test-model')) {
                const modelId = e.target.dataset.model;
                this.testSingleModel(modelId);
            }
        });

        // Search functionality
        document.getElementById('performanceSearch').addEventListener('input', (e) => {
            this.filterPerformanceTable(e.target.value);
        });
    }

    async testAllModels() {
        const resultsDiv = document.getElementById('testResults');
        resultsDiv.innerHTML = '<div class="loading">Testing all models...</div>';

        try {
            const response = await fetch('/api/test-models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const data = await response.json();
            const results = data.results.map(result => ({
                model: result.modelName,
                status: result.status === 'active' ? 'success' : 'error',
                message: result.error || 'Model responding correctly',
                responseTime: result.responseTime
            }));

            // Update model statuses
            data.results.forEach(result => {
                const model = this.models.find(m => m.type === result.modelType);
                if (model) {
                    model.status = result.status;
                }
            });

            this.displayTestResults(results);
            this.renderModelsTable();
            this.updateStats();
        } catch (error) {
            resultsDiv.innerHTML = `<div class="error">Error testing models: ${error.message}</div>`;
        }
    }

    async testSingleModel(modelId) {
        const model = this.models.find(m => m.modelId === modelId);
        if (!model) return;

        const resultsDiv = document.getElementById('testResults');
        resultsDiv.innerHTML = `<div class="loading">Testing ${model.modelName}...</div>`;

        try {
            const response = await fetch('/api/test-models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    modelIds: [model.type]
                })
            });

            const data = await response.json();
            const result = data.results[0];
            
            if (result) {
                const displayResult = {
                    model: result.modelName,
                    status: result.status === 'active' ? 'success' : 'error',
                    message: result.error || 'Model responding correctly',
                    responseTime: result.responseTime
                };

                model.status = result.status;
                this.displayTestResults([displayResult]);
                this.renderModelsTable();
                this.updateStats();
            }
        } catch (error) {
            this.displayTestResults([{
                model: model.modelName,
                status: 'error',
                message: error.message,
                responseTime: 'N/A'
            }]);
        }
    }

    displayTestResults(results) {
        const resultsDiv = document.getElementById('testResults');
        resultsDiv.innerHTML = `
            <h4>Test Results</h4>
            <div class="test-results-list">
                ${results.map(result => `
                    <div class="test-result ${result.status}">
                        <span class="result-status">${result.status === 'success' ? '✅' : '❌'}</span>
                        <span class="result-model">${result.model}</span>
                        <span class="result-message">${result.message}</span>
                        <span class="result-time">${result.responseTime}s</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    refreshModelStatus() {
        // In a real implementation, this would check actual API availability
        this.models.forEach(model => {
            model.status = 'unknown';
        });
        this.renderModelsTable();
        this.updateStats();
    }

    filterPerformanceTable(searchTerm) {
        const tbody = document.getElementById('performanceTableBody');
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            row.style.display = matches ? '' : 'none';
        });
    }

    // Load commits data for cost summary analysis
    async loadCommitsData() {
        try {
            const response = await fetch('/api/commits');
            allCommits = await response.json();
        } catch (error) {
            console.error('Error loading commits:', error);
            allCommits = [];
        }
    }

    displayAnalysisPrompt() {
        const promptElement = document.getElementById('analysisPrompt');
        if (!promptElement) return;

        // This is the exact prompt used in analyzeCommit.js
        const prompt = `Analyze this git commit and provide scores based on OBJECTIVE criteria:

Commit: {commitMessage}
Author: {author}
Files changed: {filesChanged}
Lines added: {linesAdded}
Lines deleted: {linesDeleted}

Diff:
{diffContent}

SCORING CRITERIA - Be consistent and objective:

1. Code Quality (1.0-5.0): 
   - Deduct points for: syntax errors, typos, poor structure, missing error handling
   - 1.0-2.0: Multiple errors/issues  |  2.1-3.0: Some issues  |  3.1-4.0: Minor issues  |  4.1-5.0: Clean code

2. Developer Level (1.0-3.0):
   - Based on: code patterns, architecture decisions, error handling sophistication
   - 1.0-1.5: Junior (basic changes, simple patterns)
   - 1.6-2.5: Mid-level (good practices, some architecture)  
   - 2.6-3.0: Senior (advanced patterns, excellent design)

3. Code Complexity (1.0-5.0):
   - Based on: number of files, logic complexity, integration points
   - 1.0-2.0: Simple changes  |  2.1-3.0: Moderate  |  3.1-4.0: Complex  |  4.1-5.0: Very complex

4. Estimated Development Time (hours): Realistic time for this exact change

5. AI Code Percentage (0-100): 
   - 0-20%: Clearly human-written, unique patterns
   - 21-40%: Some AI assistance likely
   - 41-60%: Moderate AI involvement
   - 61-80%: Heavy AI assistance
   - 81-100%: Mostly AI-generated

6. Estimated Hours with AI: Time with AI help (should be less than manual time)

BE OBJECTIVE: If you see typos or errors, score quality lower. If code is simple, don't overestimate complexity.

Respond ONLY in this JSON format:
{
  "code_quality": 3.7,
  "dev_level": 2.3,
  "complexity": 3.4,
  "estimated_hours": 2.75,
  "ai_percentage": 45.5,
  "estimated_hours_with_ai": 1.25,
  "reasoning": "Brief explanation focusing on specific issues or strengths observed"
}`;

        promptElement.textContent = prompt;
    }

    // Calculate cost summary by provider
    calculateCostSummary(commits) {
        const providerStats = {};
        
        commits.forEach(commit => {
            if (commit.modelScores) {
                commit.modelScores.forEach(score => {
                    const provider = score.provider || 'Unknown';
                    if (!providerStats[provider]) {
                        providerStats[provider] = {
                            tokens: 0,
                            cost: 0,
                            count: 0
                        };
                    }
                    providerStats[provider].tokens += score.tokensUsed || 0;
                    providerStats[provider].cost += score.cost || 0;
                    providerStats[provider].count++;
                });
            }
        });
        
        const tbody = document.getElementById('costSummaryBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        let grandTotalTokens = 0;
        let grandTotalCost = 0;
        let totalAnalyses = 0;
        
        Object.entries(providerStats).forEach(([provider, stats]) => {
            grandTotalTokens += stats.tokens;
            grandTotalCost += stats.cost;
            totalAnalyses += stats.count;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${provider}</td>
                <td>${stats.tokens.toLocaleString()}</td>
                <td>$${stats.cost.toFixed(4)}</td>
                <td>$${(stats.cost / stats.count).toFixed(4)}</td>
            `;
            tbody.appendChild(row);
        });
        
        const grandTotalTokensEl = document.getElementById('grandTotalTokens');
        const grandTotalCostEl = document.getElementById('grandTotalCost');
        const grandAvgCostEl = document.getElementById('grandAvgCost');
        
        if (grandTotalTokensEl) grandTotalTokensEl.textContent = grandTotalTokens.toLocaleString();
        if (grandTotalCostEl) grandTotalCostEl.textContent = `$${grandTotalCost.toFixed(4)}`;
        if (grandAvgCostEl) grandAvgCostEl.textContent = `$${(grandTotalCost / totalAnalyses).toFixed(4)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the models manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Auth check is handled by auth-utils.js
    // Only initialize models manager if user has permission
    if (checkModelsAccess()) {
        new ModelsManager();
    }
});