// AI Models Configuration and Management

// Check if user has permission to manage models
function checkModelsAccess() {
    console.log('Checking models access...');
    console.log('User data:', getUserData());
    console.log('Is admin:', isAdmin());
    
    if (!isAdmin()) {
        console.log('User is not admin, redirecting...');
        window.location.href = '/index.html';
        return false;
    }
    console.log('Admin access granted');
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
        this.apiKeyStatus = {}; // Track which models have API keys
        this.apiTokens = []; // Store API tokens
        this.init();
    }

    async loadModelsConfiguration() {
        try {
            // Load models from database
            const response = await fetch('/api/ai-models', {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const dbModels = await response.json();
                this.models = dbModels.map(model => ({
                    provider: model.provider,
                    modelName: model.model_name,
                    modelId: model.model_id,
                    status: model.status,
                    inputCost: model.input_cost,
                    outputCost: model.output_cost,
                    apiEndpoint: model.api_endpoint,
                    parameters: JSON.parse(model.parameters || '{}'),
                    envVar: model.env_var,
                    type: model.model_type,
                    notes: model.notes,
                    // Include performance data
                    avgQuality: model.avg_quality_score,
                    avgResponseTime: model.avg_response_time,
                    totalTokens: model.total_tokens,
                    totalCost: model.total_cost,
                    successCount: model.success_count,
                    errorCount: model.error_count,
                    totalAnalyses: model.total_analyses,
                    lastError: model.last_error,
                    lastUsedAt: model.last_used_at
                }));
            } else {
                const errorText = await response.text();
                console.error('API error response:', errorText);
            }
        } catch (error) {
            console.error('Error loading models configuration:', error);
            // Fallback to empty array
            this.models = [];
        }
    }

    async loadApiKeyStatus() {
        try {
            const response = await fetch('/api/ai-models/api-keys', {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                this.apiKeyStatus = {};
                
                // Map API keys to their status
                result.apiKeys.forEach(key => {
                    this.apiKeyStatus[key.key_name] = {
                        configured: true,
                        lastUsed: key.last_used_at,
                        provider: key.provider
                    };
                });
            }
        } catch (error) {
            console.error('Error loading API key status:', error);
            this.apiKeyStatus = {};
        }
    }

    async init() {
        await this.loadModelsConfiguration();
        await this.loadApiKeyStatus();
        this.renderUnifiedModelsTable();
        this.renderApiTokensTable(); // Add mock tokens table
        this.updateStats();
        this.bindEvents();
        await this.loadCommitsData();
        this.calculateCostSummary(allCommits);
        this.displayAnalysisPrompt();
    }

    initializeApiTokens() {
        // Initialize with mock data if no tokens exist
        if (this.apiTokens.length === 0) {
            this.apiTokens = [
            {
                provider: 'OpenAI',
                token: 'sk-proj-abcdefghijklmnopqrstuvwxyz123456789',
                uploadedBy: 'admin',
                uploadDate: '2025-01-05',
                lastUsed: '2025-01-06 14:32',
                status: 'active',
                models: ['o3', 'o3-mini', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
                spendingLimit: 500.00,
                limitPeriod: 'monthly'
            },
            {
                provider: 'Anthropic',
                token: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456789',
                uploadedBy: 'john.doe',
                uploadDate: '2025-01-03',
                lastUsed: '2025-01-06 15:45',
                status: 'active',
                models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku', 'claude-3-sonnet', 'claude-2.1', 'claude-instant', 'claude-2'],
                spendingLimit: 250.00,
                limitPeriod: 'weekly'
            },
            {
                provider: 'Google',
                token: 'AIzaSyB-abcdefghijklmnopqrstuvwxyz12345',
                uploadedBy: 'jane.smith',
                uploadDate: '2025-01-02',
                lastUsed: '2025-01-04 09:12',
                status: 'active',
                models: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro', 'gemini-exp'],
                spendingLimit: null,
                limitPeriod: null
            },
            {
                provider: 'xAI',
                token: 'xai-abcdefghijklmnopqrstuvwxyz123456789',
                uploadedBy: 'admin',
                uploadDate: '2024-12-28',
                lastUsed: '2024-12-30 16:20',
                status: 'expired',
                models: ['grok-3', 'grok-2', 'grok-vision', 'grok-1.5', 'grok-mini'],
                spendingLimit: 1000.00,
                limitPeriod: 'accumulated'
            },
            {
                provider: 'OpenAI',
                token: 'sk-proj-zyxwvutsrqponmlkjihgfedcba987654321',
                uploadedBy: 'dev.user',
                uploadDate: '2024-12-15',
                lastUsed: 'Never',
                status: 'inactive',
                models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-vision'],
                spendingLimit: 100.00,
                limitPeriod: 'daily'
            }
        ];
        }
    }

    renderApiTokensTable() {
        const tbody = document.getElementById('apiTokensTableBody');
        const emptyState = document.getElementById('tokensEmptyState');
        
        // Initialize tokens if needed
        this.initializeApiTokens();
        
        if (this.apiTokens.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        tbody.innerHTML = this.apiTokens.map(token => {
            // Show only last 5 characters of the token
            const maskedToken = '•••' + token.token.slice(-5);
            
            // Generate models badges
            const modelsHtml = token.models ? this.renderModelsBadges(token.models, token.provider) : '<span class="no-data">No models</span>';
            
            // Format spending limit display
            const spendingLimitDisplay = token.spendingLimit ? 
                `$${token.spendingLimit.toFixed(2)}` : 
                '<span class="no-data">No limit</span>';
            
            const periodDisplay = token.limitPeriod ? 
                this.formatPeriodDisplay(token.limitPeriod) : 
                '<span class="no-data">—</span>';

            return `
                <tr>
                    <td><span class="provider-badge ${token.provider.toLowerCase()}">${token.provider}</span></td>
                    <td><span class="token-display">${maskedToken}</span></td>
                    <td>
                        <div class="models-list">
                            ${modelsHtml}
                        </div>
                    </td>
                    <td>${spendingLimitDisplay}</td>
                    <td>${periodDisplay}</td>
                    <td>${token.uploadedBy}</td>
                    <td>${token.uploadDate}</td>
                    <td>${token.lastUsed}</td>
                    <td><span class="status-${token.status}">${token.status.charAt(0).toUpperCase() + token.status.slice(1)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-small secondary" onclick="testApiToken('${token.provider}', '${token.token}')">Test</button>
                            <button class="btn btn-small danger" onclick="deleteApiToken('${token.provider}', '${token.token}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add search functionality
        const searchInput = document.getElementById('tokensSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const rows = tbody.getElementsByTagName('tr');
                
                Array.from(rows).forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        }
        
        // Add button functionality
        const addTokenBtn = document.getElementById('addNewToken');
        if (addTokenBtn) {
            addTokenBtn.addEventListener('click', () => {
                window.openAddApiTokenModal();
            });
        }
    }

    renderModelsBadges(models, provider) {
        if (!models || models.length === 0) {
            return '<span class="no-data">No models</span>';
        }
        
        const providerClass = provider.toLowerCase() + '-model';
        
        return models.map(model => 
            `<span class="model-badge ${providerClass}">${model}</span>`
        ).join('');
    }

    formatPeriodDisplay(period) {
        const periodLabels = {
            'daily': 'Daily',
            'weekly': 'Weekly', 
            'monthly': 'Monthly',
            'accumulated': 'Total'
        };
        return periodLabels[period] || period;
    }

    addNewApiToken(provider, token, uploadedBy = 'current_user') {
        // Generate realistic models for the provider
        const providerModels = this.getDefaultModelsForProvider(provider);
        
        // Get spending limit data from the form
        const enableLimit = document.getElementById('enableSpendingLimit').checked;
        const spendingLimit = enableLimit ? parseFloat(document.getElementById('spendingLimit').value) : null;
        const limitPeriod = enableLimit ? document.getElementById('limitPeriod').value : null;
        
        const newToken = {
            provider: provider.charAt(0).toUpperCase() + provider.slice(1),
            token: token,
            uploadedBy: uploadedBy,
            uploadDate: new Date().toISOString().split('T')[0],
            lastUsed: 'Never',
            status: 'active',
            models: providerModels,
            spendingLimit: spendingLimit,
            limitPeriod: limitPeriod
        };
        
        this.apiTokens.push(newToken);
        this.renderApiTokensTable();
    }

    getDefaultModelsForProvider(provider) {
        const modelsByProvider = {
            'anthropic': ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku', 'claude-2.1', 'claude-instant', 'claude-2'],
            'openai': ['o3', 'o3-mini', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
            'xai': ['grok-3', 'grok-2', 'grok-vision', 'grok-1.5', 'grok-mini'],
            'google': ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'],
            'mistral': ['mistral-large', 'mistral-medium', 'mistral-small', 'mixtral-8x7b', 'mixtral-8x22b', 'codestral'],
            'alibaba': ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder', 'qwen-vl', 'qwen-audio'],
            'meta': ['llama-3.1-405b', 'llama-3.1-70b', 'llama-3.1-8b', 'llama-3-70b', 'llama-3-8b', 'code-llama'],
            'nvidia': ['nemotron-4', 'nemo-instruct', 'nemo-guardrails', 'nvidia-llama', 'nvidia-mistral', 'chatqa']
        };
        
        return modelsByProvider[provider.toLowerCase()] || [`${provider.toLowerCase()}-model-1`];
    }

    renderUnifiedModelsTable() {
        const tbody = document.getElementById('unifiedModelsTableBody');
        tbody.innerHTML = '';

        this.models.forEach(model => {
            // Use performance data from model itself (loaded from database)
            const successRate = model.totalAnalyses > 0 ? 
                (model.successCount / model.totalAnalyses * 100) : 0;
                
            const performanceData = {
                avgQuality: model.avgQuality || 0,
                avgResponseTime: model.avgResponseTime || 0,
                totalTokens: model.totalTokens || 0,
                totalCost: model.totalCost || 0,
                successRate: successRate,
                lastError: model.lastError || null
            };

            const row = document.createElement('tr');
            row.className = `model-row model-${model.status}`;

            // Determine overall status based on both configuration and performance
            let displayStatus = model.status;
            let statusClass = model.status;
            
            if (model.status === 'active' && performanceData.successRate < 100) {
                displayStatus = 'warning';
                statusClass = 'warning';
            } else if (model.status === 'active' && performanceData.successRate === 0) {
                displayStatus = 'error';
                statusClass = 'error';
            }

            row.innerHTML = `
                <td><span class="provider-badge ${model.provider.toLowerCase()}">${model.provider}</span></td>
                <td>
                    <div class="model-info">
                        <strong>${model.modelName}</strong>
                        <br><small><code>${model.modelId}</code></small>
                    </div>
                </td>
                <td><span class="status-badge status-${statusClass}">${displayStatus.toUpperCase()}</span></td>
                <td>
                    ${performanceData.avgQuality > 0 ? 
                        `<span class="quality-badge quality-${Math.floor(performanceData.avgQuality)}">${performanceData.avgQuality.toFixed(1)}/5</span>` : 
                        '<span class="no-data">No data</span>'
                    }
                </td>
                <td>
                    ${performanceData.avgResponseTime > 0 ? 
                        `${performanceData.avgResponseTime.toFixed(1)}s` : 
                        '<span class="no-data">No data</span>'
                    }
                </td>
                <td>
                    ${performanceData.successRate >= 0 ? 
                        `<span class="success-rate-badge rate-${performanceData.successRate === 100 ? 'excellent' : performanceData.successRate >= 80 ? 'good' : performanceData.successRate > 0 ? 'poor' : 'none'}">${performanceData.successRate.toFixed(0)}%</span>` : 
                        '<span class="no-data">No data</span>'
                    }
                </td>
                <td><small>${model.inputCost}</small></td>
                <td><small>${model.outputCost}</small></td>
                <td>
                    ${performanceData.totalTokens > 0 ? 
                        `${performanceData.totalTokens.toLocaleString()}` : 
                        '<span class="no-data">0</span>'
                    }
                </td>
                <td>
                    ${performanceData.totalCost > 0 ? 
                        `$${performanceData.totalCost.toFixed(4)}` : 
                        '<span class="no-data">$0.00</span>'
                    }
                </td>
                <td><small>${this.getLastUsed(model)}</small></td>
                <td>
                    <div class="action-buttons">
                        ${this.renderConnectButton(model)}
                        <button class="btn small secondary test-model" data-model="${model.modelId}" title="Test Model">Test</button>
                        <button class="btn small secondary toggle-model" data-model="${model.modelId}" title="${model.status === 'active' ? 'Disable' : 'Enable'} Model">
                            ${model.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn small warning edit-model" data-model="${model.modelId}" title="Edit Model">Edit</button>
                        <button class="btn small danger delete-model" data-model="${model.modelId}" title="Delete Model">Delete</button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });

        // Update totals row
        this.updateUnifiedTableTotals();
    }

    updateUnifiedTableTotals() {
        let totalTokens = 0;
        let totalCost = 0;
        let totalAnalyses = 0;

        this.models.forEach(model => {
            totalTokens += model.totalTokens || 0;
            totalCost += model.totalCost || 0;
            totalAnalyses += model.totalAnalyses || 0;
        });

        const avgCostPerAnalysis = totalAnalyses > 0 ? totalCost / totalAnalyses : 0;

        const grandTotalTokensEl = document.getElementById('grandTotalTokensUnified');
        const grandTotalCostEl = document.getElementById('grandTotalCostUnified');
        const avgCostPerAnalysisEl = document.getElementById('avgCostPerAnalysisUnified');

        if (grandTotalTokensEl) grandTotalTokensEl.textContent = totalTokens.toLocaleString();
        if (grandTotalCostEl) grandTotalCostEl.textContent = `$${totalCost.toFixed(4)}`;
        if (avgCostPerAnalysisEl) avgCostPerAnalysisEl.textContent = `$${avgCostPerAnalysis.toFixed(4)}`;
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

    getLastUsed(model) {
        if (model.lastUsedAt) {
            const date = new Date(model.lastUsedAt);
            return date.toLocaleDateString();
        }
        return 'Never';
    }

    renderConnectButton(model) {
        const keyStatus = this.apiKeyStatus[model.envVar];
        const isConfigured = keyStatus && keyStatus.configured;
        
        if (isConfigured) {
            return `<button class="btn small success connect-model" data-model="${model.modelId}" data-provider="${model.provider}" title="API Key Configured - Click to Update">
                ✓ Connected
            </button>`;
        } else {
            return `<button class="btn small primary connect-model" data-model="${model.modelId}" data-provider="${model.provider}" title="Configure API Key">
                Connect
            </button>`;
        }
    }



    updateStats() {
        const activeModels = this.models.filter(m => m.status === 'active').length;
        const inactiveModels = this.models.length - activeModels;
        
        // Calculate totals from models directly
        const totalCost = this.models.reduce((sum, model) => sum + (model.totalCost || 0), 0);
        
        const modelsWithData = this.models.filter(m => m.avgResponseTime > 0);
        const avgResponseTime = modelsWithData.length > 0 ?
            modelsWithData.reduce((sum, m) => sum + m.avgResponseTime, 0) / modelsWithData.length : 0;

        document.getElementById('activeModels').textContent = activeModels;
        document.getElementById('inactiveModels').textContent = inactiveModels;
        document.getElementById('totalCost').textContent = `$${totalCost.toFixed(4)}`;
        document.getElementById('avgResponseTime').textContent = `${avgResponseTime.toFixed(1)}s`;
    }


    bindEvents() {
        // Test all models button
        document.getElementById('testAllModels').addEventListener('click', () => {
            this.testAllModels();
        });

        // Add new model button
        document.getElementById('addNewModel').addEventListener('click', () => {
            this.openModelModal();
        });


        // Individual action buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('test-model')) {
                const modelId = e.target.dataset.model;
                this.testSingleModel(modelId);
            } else if (e.target.classList.contains('toggle-model')) {
                const modelId = e.target.dataset.model;
                this.toggleModelStatus(modelId);
            } else if (e.target.classList.contains('connect-model')) {
                const modelId = e.target.dataset.model;
                const provider = e.target.dataset.provider;
                this.openApiKeyModal(modelId, provider);
            } else if (e.target.classList.contains('edit-model')) {
                const modelId = e.target.dataset.model;
                this.editModel(modelId);
            } else if (e.target.classList.contains('delete-model')) {
                const modelId = e.target.dataset.model;
                this.deleteModel(modelId);
            }
        });

        // Search functionality
        document.getElementById('modelsSearch').addEventListener('input', (e) => {
            this.filterUnifiedTable(e.target.value);
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
            this.renderUnifiedModelsTable();
            this.updateStats();
        } catch (error) {
            resultsDiv.innerHTML = `<div class="error">Error testing models: ${error.message}</div>`;
        }
    }

    async testSingleModel(modelId) {
        const model = this.models.find(m => m.modelId === modelId);
        if (!model) {
            console.error('Model not found:', modelId);
            return;
        }

        console.log(`Testing single model: ${model.modelName}`);

        try {
            const response = await fetch('/api/test-models', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    modelIds: [model.type]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            const result = data.results[0];
            
            if (result) {
                const displayResult = {
                    model: result.modelName,
                    status: result.status === 'active' ? 'success' : 'error',
                    message: result.error || 'Model responding correctly',
                    responseTime: result.responseTime
                };

                // Update local model status
                model.status = result.status;
                
                // Display results in modal
                this.displayTestResults([displayResult]);
                
                // Refresh the table
                this.renderUnifiedModelsTable();
                this.updateStats();
            } else {
                throw new Error('No test result returned');
            }
        } catch (error) {
            console.error('Error testing model:', error);
            this.displayTestResults([{
                model: model.modelName,
                status: 'error',
                message: error.message,
                responseTime: 'N/A'
            }]);
        }
    }

    async toggleModelStatus(modelId) {
        const model = this.models.find(m => m.modelId === modelId);
        if (!model) {
            console.error('Model not found:', modelId);
            return;
        }

        console.log(`Toggling model status: ${model.modelName} (${model.status})`);

        try {
            // Determine new status
            const newStatus = model.status === 'active' ? 'inactive' : 'active';
            
            // Update via API
            const response = await fetch(`/api/ai-models/${modelId}/status`, {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            // Update local model
            model.status = newStatus;
            
            // Refresh the table
            this.renderUnifiedModelsTable();
            this.updateStats();
            
            console.log(`Model ${model.modelName} status updated to: ${newStatus}`);
            
        } catch (error) {
            console.error('Error toggling model status:', error);
            alert(`Failed to update model status: ${error.message}`);
        }
    }

    displayTestResults(results) {
        const modal = document.getElementById('testResultsModal');
        const resultsDiv = document.getElementById('modalTestResults');
        
        // Store results for potential status update
        this.lastTestResults = results;
        
        resultsDiv.innerHTML = `
            <div class="test-results-list" style="max-height: 400px; overflow-y: auto;">
                ${results.map(result => `
                    <div class="test-result ${result.status}" style="padding: 10px; margin-bottom: 10px; border-radius: 5px; background: ${result.status === 'success' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'}; border: 1px solid ${result.status === 'success' ? '#28a745' : '#dc3545'};">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span class="result-status" style="font-size: 20px; margin-right: 10px;">${result.status === 'success' ? '✅' : '❌'}</span>
                                <span class="result-model" style="font-weight: bold;">${result.model}</span>
                            </div>
                            <span class="result-time" style="color: #6c757d;">${result.responseTime}s</span>
                        </div>
                        <div style="margin-top: 5px; margin-left: 30px;">
                            <span class="result-message" style="color: ${result.status === 'success' ? '#28a745' : '#dc3545'};">${result.message}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.style.display = 'block';
    }

    refreshModelStatus() {
        // In a real implementation, this would check actual API availability
        this.models.forEach(model => {
            model.status = 'unknown';
        });
        this.renderUnifiedModelsTable();
        this.updateStats();
    }

    filterUnifiedTable(searchTerm) {
        const tbody = document.getElementById('unifiedModelsTableBody');
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

    async applyTestResultsToModels() {
        if (!this.lastTestResults) return;
        
        // Update local model statuses
        this.lastTestResults.forEach(result => {
            const model = this.models.find(m => m.modelName === result.model);
            if (model) {
                model.status = result.status === 'success' ? 'active' : 'error';
            }
        });
        
        // Save to database
        try {
            for (const result of this.lastTestResults) {
                const model = this.models.find(m => m.modelName === result.model);
                if (model) {
                    await fetch(`/api/ai-models/${model.modelId}/status`, {
                        method: 'PUT',
                        headers: {
                            ...getAuthHeaders(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            status: result.status === 'success' ? 'active' : 'error'
                        })
                    });
                }
            }
            
            // Reload models from database to get updated data
            await this.loadModelsConfiguration();
        } catch (error) {
            console.error('Error updating model statuses:', error);
        }
        
        this.renderUnifiedModelsTable();
        this.updateStats();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    openApiKeyModal(modelId, provider) {
        const modal = document.getElementById('apiKeyModal');
        const providerNameInput = document.getElementById('providerName');
        const apiKeyInput = document.getElementById('apiKeyInput');
        
        // Store current model info for saving
        this.currentModelConfig = { modelId, provider };
        
        // Set provider name
        providerNameInput.value = provider;
        
        // Clear previous input
        apiKeyInput.value = '';
        
        // Show modal
        modal.style.display = 'block';
        
        // Focus on the API key input
        setTimeout(() => apiKeyInput.focus(), 100);
    }

    async saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKeyValue = apiKeyInput.value.trim();
        
        if (!apiKeyValue) {
            alert('Please enter an API key');
            return;
        }
        
        if (!this.currentModelConfig) {
            alert('No model selected');
            return;
        }
        
        try {
            // Map provider to environment variable name
            const providerKeyMap = {
                'OpenAI': 'OPENAI_API_KEY',
                'Anthropic': 'CLAUDE_API_KEY',
                'Google': 'GEMINI_API_KEY',
                'xAI': 'GROK_API_KEY'
            };
            
            const envKeyName = providerKeyMap[this.currentModelConfig.provider];
            if (!envKeyName) {
                alert(`Unknown provider: ${this.currentModelConfig.provider}`);
                return;
            }
            
            // Send API key to server
            const response = await fetch('/api/ai-models/api-keys', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    modelId: this.currentModelConfig.modelId,
                    provider: this.currentModelConfig.provider,
                    keyName: envKeyName,
                    keyValue: apiKeyValue
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                alert(`API key saved successfully for ${this.currentModelConfig.provider}!`);
                this.closeApiKeyModal();
                
                // Refresh the models table to show updated status
                await this.loadModelsConfiguration();
                await this.loadApiKeyStatus();
                this.renderUnifiedModelsTable();
                this.updateStats();
            } else {
                throw new Error(result.error || 'Failed to save API key');
            }
            
        } catch (error) {
            console.error('Error saving API key:', error);
            alert(`Failed to save API key: ${error.message}`);
        }
    }

    closeApiKeyModal() {
        const modal = document.getElementById('apiKeyModal');
        modal.style.display = 'none';
        this.currentModelConfig = null;
    }

    // Model CRUD Operations
    openModelModal(modelId = null) {
        const modal = document.getElementById('modelModal');
        const title = document.getElementById('modelModalTitle');
        const updateApiKeyBtn = document.getElementById('updateApiKeyFromModal');
        
        this.currentEditingModelId = modelId;
        
        if (modelId) {
            // Edit mode
            title.textContent = 'Edit AI Model';
            this.populateModelForm(modelId);
            updateApiKeyBtn.style.display = 'inline-block';
        } else {
            // Add mode
            title.textContent = 'Add New AI Model';
            this.clearModelForm();
            updateApiKeyBtn.style.display = 'none';
        }
        
        modal.style.display = 'block';
    }

    clearModelForm() {
        document.getElementById('modelIdInput').value = '';
        document.getElementById('providerInput').value = '';
        document.getElementById('modelNameInput').value = '';
        document.getElementById('modelTypeInput').value = '';
        document.getElementById('inputCostInput').value = '';
        document.getElementById('outputCostInput').value = '';
        document.getElementById('apiEndpointInput').value = '';
        document.getElementById('envVarInput').value = '';
        document.getElementById('statusInput').value = 'inactive';
        document.getElementById('parametersInput').value = '{}';
        document.getElementById('notesInput').value = '';
        
        // Enable model ID input for new models
        document.getElementById('modelIdInput').disabled = false;
    }

    populateModelForm(modelId) {
        const model = this.models.find(m => m.modelId === modelId);
        if (!model) return;
        
        document.getElementById('modelIdInput').value = model.modelId;
        document.getElementById('providerInput').value = model.provider;
        document.getElementById('modelNameInput').value = model.modelName;
        document.getElementById('modelTypeInput').value = model.type;
        document.getElementById('inputCostInput').value = model.inputCost;
        document.getElementById('outputCostInput').value = model.outputCost;
        document.getElementById('apiEndpointInput').value = model.apiEndpoint;
        document.getElementById('envVarInput').value = model.envVar;
        document.getElementById('statusInput').value = model.status;
        document.getElementById('parametersInput').value = JSON.stringify(model.parameters || {}, null, 2);
        document.getElementById('notesInput').value = model.notes || '';
        
        // Disable model ID input for existing models
        document.getElementById('modelIdInput').disabled = true;
    }

    async saveModel() {
        const modelData = {
            model_id: document.getElementById('modelIdInput').value.trim(),
            provider: document.getElementById('providerInput').value,
            model_name: document.getElementById('modelNameInput').value.trim(),
            model_type: document.getElementById('modelTypeInput').value,
            input_cost: document.getElementById('inputCostInput').value.trim(),
            output_cost: document.getElementById('outputCostInput').value.trim(),
            api_endpoint: document.getElementById('apiEndpointInput').value.trim(),
            env_var: document.getElementById('envVarInput').value.trim(),
            status: document.getElementById('statusInput').value,
            parameters: document.getElementById('parametersInput').value.trim(),
            notes: document.getElementById('notesInput').value.trim()
        };

        // Validate required fields
        const requiredFields = ['model_id', 'provider', 'model_name', 'model_type', 'input_cost', 'output_cost', 'api_endpoint', 'env_var'];
        for (const field of requiredFields) {
            if (!modelData[field]) {
                alert(`Please fill in the ${field.replace('_', ' ')} field`);
                return;
            }
        }

        // Validate JSON parameters
        try {
            JSON.parse(modelData.parameters);
        } catch (e) {
            alert('Parameters must be valid JSON');
            return;
        }

        try {
            const url = this.currentEditingModelId ? 
                `/api/ai-models/${this.currentEditingModelId}` : 
                '/api/ai-models';
            
            const method = this.currentEditingModelId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(modelData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                alert(`Model ${this.currentEditingModelId ? 'updated' : 'created'} successfully!`);
                this.closeModelModal();
                
                // Refresh the models table
                await this.loadModelsConfiguration();
                await this.loadApiKeyStatus();
                this.renderUnifiedModelsTable();
                this.updateStats();
            } else {
                throw new Error(result.error || 'Failed to save model');
            }

        } catch (error) {
            console.error('Error saving model:', error);
            alert(`Failed to save model: ${error.message}`);
        }
    }

    async editModel(modelId) {
        this.openModelModal(modelId);
    }

    async deleteModel(modelId) {
        const model = this.models.find(m => m.modelId === modelId);
        if (!model) return;

        if (!confirm(`Are you sure you want to delete the model "${model.modelName}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/ai-models/${modelId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                alert('Model deleted successfully!');
                
                // Refresh the models table
                await this.loadModelsConfiguration();
                await this.loadApiKeyStatus();
                this.renderUnifiedModelsTable();
                this.updateStats();
            } else {
                throw new Error(result.error || 'Failed to delete model');
            }

        } catch (error) {
            console.error('Error deleting model:', error);
            alert(`Failed to delete model: ${error.message}`);
        }
    }

    closeModelModal() {
        const modal = document.getElementById('modelModal');
        modal.style.display = 'none';
        this.currentEditingModelId = null;
    }

    updateApiKeyFromModal() {
        if (!this.currentEditingModelId) {
            alert('No model selected');
            return;
        }

        const model = this.models.find(m => m.modelId === this.currentEditingModelId);
        if (!model) {
            alert('Model not found');
            return;
        }

        // Close the model modal and open the API key modal
        this.closeModelModal();
        
        // Small delay to ensure modal is closed before opening new one
        setTimeout(() => {
            this.openApiKeyModal(model.modelId, model.provider);
        }, 100);
    }
}

// Global functions for modals
window.closeTestResultsModal = function() {
    document.getElementById('testResultsModal').style.display = 'none';
};

window.updateModelStatuses = async function() {
    if (window.modelsManager && window.modelsManager.lastTestResults) {
        await window.modelsManager.applyTestResultsToModels();
        window.closeTestResultsModal();
    }
};

window.closeApiKeyModal = function() {
    if (window.modelsManager) {
        window.modelsManager.closeApiKeyModal();
    }
};

window.saveApiKey = async function() {
    if (window.modelsManager) {
        await window.modelsManager.saveApiKey();
    }
};

window.closeModelModal = function() {
    if (window.modelsManager) {
        window.modelsManager.closeModelModal();
    }
};

window.saveModel = async function() {
    if (window.modelsManager) {
        await window.modelsManager.saveModel();
    }
};

window.updateApiKeyFromModal = function() {
    if (window.modelsManager) {
        window.modelsManager.updateApiKeyFromModal();
    }
};

// Mock functions for API token actions
window.testApiToken = function(provider, token) {
    alert(`Testing ${provider} API token: •••${token.slice(-5)}\n\nThis is a mock function. In production, this would test the API token validity.`);
};

window.deleteApiToken = function(provider, token) {
    if (confirm(`Are you sure you want to delete the ${provider} API token ending in ${token.slice(-5)}?`)) {
        alert(`Deleted ${provider} API token: •••${token.slice(-5)}\n\nThis is a mock function. In production, this would remove the token from the database.`);
        // In production, this would refresh the table after deletion
        if (window.modelsManager) {
            window.modelsManager.renderApiTokensTable();
        }
    }
};

// Modal functions for Add API Token
window.openAddApiTokenModal = function() {
    const modal = document.getElementById('addApiTokenModal');
    if (modal) {
        modal.classList.add('show');
        // Clear form
        document.getElementById('addApiTokenForm').reset();
        // Update helper text for selected provider
        updateTokenHelperText();
        // Hide spending limit options initially
        document.getElementById('spendingLimitOptions').style.display = 'none';
        document.getElementById('enableSpendingLimit').checked = false;
    }
};

window.closeAddApiTokenModal = function() {
    const modal = document.getElementById('addApiTokenModal');
    if (modal) {
        modal.classList.remove('show');
    }
};

window.handleApiTokenSubmit = function(event) {
    event.preventDefault();
    
    const provider = document.getElementById('tokenProvider').value;
    const token = document.getElementById('apiToken').value;
    const enableLimit = document.getElementById('enableSpendingLimit').checked;
    
    if (!provider || !token) {
        alert('Please fill in all required fields.');
        return;
    }
    
    // Validate spending limit if enabled
    if (enableLimit) {
        const spendingLimit = document.getElementById('spendingLimit').value;
        const limitPeriod = document.getElementById('limitPeriod').value;
        
        if (!spendingLimit || !limitPeriod || parseFloat(spendingLimit) <= 0) {
            alert('Please enter a valid spending limit and period.');
            return;
        }
    }
    
    // Close add modal and show test modal
    closeAddApiTokenModal();
    showTokenTestModal(provider, token);
};

function updateTokenHelperText() {
    const provider = document.getElementById('tokenProvider').value;
    const helperText = document.getElementById('tokenHelperText');
    
    const helperTexts = {
        'anthropic': 'Enter your Anthropic API key (starts with sk-ant-)',
        'openai': 'Enter your OpenAI API key (starts with sk-proj- or sk-)',
        'xai': 'Enter your xAI API key (starts with xai-)',
        'google': 'Enter your Google AI API key (starts with AIza)',
        'mistral': 'Enter your Mistral API key',
        'alibaba': 'Enter your Alibaba Cloud API key',
        'meta': 'Enter your Meta API key',
        'nvidia': 'Enter your NVIDIA API key'
    };
    
    helperText.textContent = helperTexts[provider] || 'Enter the API token provided by your selected provider';
}

function showTokenTestModal(provider, token) {
    const modal = document.getElementById('tokenTestModal');
    const statusMessage = document.getElementById('testStatusMessage');
    
    if (modal && statusMessage) {
        modal.classList.add('show');
        statusMessage.textContent = `Testing ${provider} API token...`;
        
        // Simulate API validation (mock)
        setTimeout(() => {
            simulateTokenTest(provider, token);
        }, 2000);
    }
}

function simulateTokenTest(provider, token) {
    const modal = document.getElementById('tokenTestModal');
    
    // Mock validation - randomly succeed or fail for demo
    const isValid = Math.random() > 0.2; // 80% success rate for demo
    
    if (isValid) {
        // Success - add token to table
        addTokenToTable(provider, token);
        
        // Close test modal
        modal.classList.remove('show');
        
        // Show success message
        const limitInfo = document.getElementById('enableSpendingLimit').checked ? 
            `\nSpending limit: $${document.getElementById('spendingLimit').value} (${document.getElementById('limitPeriod').value})` : 
            '\nNo spending limit set';
            
        alert(`✅ ${provider} API token validated successfully!\n\nThe token has been added to your account and is ready to use.${limitInfo}`);
        
        // Refresh the tokens table
        if (window.modelsManager) {
            window.modelsManager.renderApiTokensTable();
        }
    } else {
        // Failure
        modal.classList.remove('show');
        alert(`❌ ${provider} API token validation failed.\n\nPlease check your token and try again. Common issues:\n• Invalid token format\n• Token expired\n• Insufficient permissions`);
    }
}

function addTokenToTable(provider, token) {
    // Add to the ModelsManager instance
    if (window.modelsManager) {
        window.modelsManager.addNewApiToken(provider, token);
    }
    
    // This is a mock function - in production, this would save to database
    console.log(`Mock: Adding ${provider} token to database:`, {
        provider: provider,
        token: '•••' + token.slice(-5),
        uploadedBy: 'current_user', // Would get from session
        uploadDate: new Date().toISOString().split('T')[0],
        lastUsed: 'Never',
        status: 'active'
    });
}

// Add event listener for provider dropdown change and spending limit checkbox
document.addEventListener('DOMContentLoaded', () => {
    const providerSelect = document.getElementById('tokenProvider');
    if (providerSelect) {
        providerSelect.addEventListener('change', updateTokenHelperText);
    }
    
    const enableSpendingLimit = document.getElementById('enableSpendingLimit');
    if (enableSpendingLimit) {
        enableSpendingLimit.addEventListener('change', function() {
            const spendingLimitOptions = document.getElementById('spendingLimitOptions');
            const spendingLimitInput = document.getElementById('spendingLimit');
            const limitPeriodSelect = document.getElementById('limitPeriod');
            
            if (this.checked) {
                spendingLimitOptions.style.display = 'block';
                spendingLimitInput.required = true;
                limitPeriodSelect.required = true;
            } else {
                spendingLimitOptions.style.display = 'none';
                spendingLimitInput.required = false;
                limitPeriodSelect.required = false;
                // Clear values
                spendingLimitInput.value = '';
                limitPeriodSelect.value = 'monthly';
            }
        });
    }
});

// Initialize the models manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Auth check is handled by auth-utils.js
    // Only initialize models manager if user has permission
    if (checkModelsAccess()) {
        window.modelsManager = new ModelsManager();
    }
});

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const testResultsModal = document.getElementById('testResultsModal');
    const apiKeyModal = document.getElementById('apiKeyModal');
    const modelModal = document.getElementById('modelModal');
    const addApiTokenModal = document.getElementById('addApiTokenModal');
    const tokenTestModal = document.getElementById('tokenTestModal');
    
    if (event.target === testResultsModal) {
        window.closeTestResultsModal();
    } else if (event.target === apiKeyModal) {
        window.closeApiKeyModal();
    } else if (event.target === modelModal) {
        window.closeModelModal();
    } else if (event.target === addApiTokenModal) {
        window.closeAddApiTokenModal();
    } else if (event.target === tokenTestModal) {
        tokenTestModal.classList.remove('show');
    }
});