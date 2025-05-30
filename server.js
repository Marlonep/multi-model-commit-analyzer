import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIModels } from './analyzeCommit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// API endpoint to get commit history
app.get('/api/commits', async (req, res) => {
  try {
    const data = await fs.readFile('commit_analysis_history.json', 'utf8');
    const history = JSON.parse(data);
    
    // Sort by timestamp descending (latest first)
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(history);
  } catch (error) {
    res.json([]);
  }
});

/**
 * GET /api/commits/:index
 * Returns a specific commit analysis by array index
 * 
 * @param {number} index - Array index of the commit
 */
app.get('/api/commits/:index', async (req, res) => {
  try {
    const data = await fs.readFile('commit_analysis_history.json', 'utf8');
    const history = JSON.parse(data);
    
    // Sort by timestamp descending to match frontend
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const index = parseInt(req.params.index);
    
    if (index >= 0 && index < history.length) {
      res.json(history[index]);
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to test AI models
app.post('/api/test-models', async (req, res) => {
  try {
    const { modelIds } = req.body;
    const aiModels = new AIModels();
    
    const results = [];
    const testModels = modelIds ? 
      aiModels.models.filter(m => modelIds.includes(m.type)) : 
      aiModels.models;
    
    for (const model of testModels) {
      try {
        const startTime = Date.now();
        
        // Simple test prompt
        const testPrompt = "Respond with 'OK' if you can process this message.";
        const result = await aiModels.getModelResponse(model, testPrompt);
        const responseTime = (Date.now() - startTime) / 1000;
        
        results.push({
          modelType: model.type,
          modelName: model.name === 'GPT-4' ? 'o3-mini' : model.name,
          status: result && result.reasoning !== 'Error' && !result.reasoning.startsWith('Error') ? 'active' : 'error',
          responseTime: responseTime.toFixed(2),
          error: result && result.reasoning.startsWith('Error') ? result.reasoning : null,
          cost: result ? result.cost : 0,
          tokens: result ? result.tokensUsed : 0
        });
      } catch (error) {
        results.push({
          modelType: model.type,
          modelName: model.name === 'GPT-4' ? 'o3-mini' : model.name,
          status: 'error',
          responseTime: 0,
          error: error.message,
          cost: 0,
          tokens: 0
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🌐 Commit Analyzer Web Interface
================================
Server running at: http://localhost:${PORT}
  
Pages:
- Commit History: http://localhost:${PORT}/
- Analysis Details: Click on any commit in the table
  
Press Ctrl+C to stop the server
`);
});