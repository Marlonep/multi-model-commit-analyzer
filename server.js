import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AIModels } from './analyzeCommit.js';
import { authenticateUser, verifyToken, requireAuth } from './auth.js';
import cookieParser from 'cookie-parser';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Authentication middleware for static files
app.use((req, res, next) => {
    // Allow access to login page and its assets
    if (req.path === '/login.html' || 
        req.path === '/login.js' || 
        req.path === '/styles.css' ||
        req.path.startsWith('/api/login') ||
        req.path.startsWith('/api/verify')) {
        return next();
    }
    
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
            return next();
        }
    }
    
    // No valid token, redirect to login
    if (req.path === '/' || req.path.endsWith('.html')) {
        res.redirect('/login');
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

// Serve static files after auth check
app.use(express.static('public'));

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const result = await authenticateUser(username, password);
        
        if (!result) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        res.json({
            token: result.token,
            username: result.user.username,
            name: result.user.name,
            role: result.user.role
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Verify token endpoint
app.get('/api/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.json({ valid: true, user: decoded });
});

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

// API endpoint to get GitHub configuration
app.get('/api/github-config', async (req, res) => {
  try {
    // Extract GitHub information from git remote URL
    const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url');
    const cleanUrl = remoteUrl.trim().replace(/\.git$/, '');
    
    // Parse GitHub URL to extract username and repository
    const match = cleanUrl.match(/github\.com[:/]([^/]+)\/([^/\s]+)$/);
    
    if (match) {
      res.json({
        username: match[1],
        repository: match[2],
        baseUrl: `https://github.com/${match[1]}/${match[2]}`
      });
    } else {
      // Fallback configuration
      res.json({
        username: 'Marlonep',
        repository: 'multi-model-commit-analyzer',
        baseUrl: 'https://github.com/Marlonep/multi-model-commit-analyzer'
      });
    }
  } catch (error) {
    // Fallback configuration on error
    res.json({
      username: 'Marlonep',
      repository: 'multi-model-commit-analyzer',
      baseUrl: 'https://github.com/Marlonep/multi-model-commit-analyzer'
    });
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

// API endpoint to update commit status
app.put('/api/commits/:hash/status', async (req, res) => {
  try {
    const { hash } = req.params;
    const { status, changedBy } = req.body;
    const dataFile = './commit_analysis_history.json';
    
    // Validate status
    if (!['ok', 'abnormal', 'error'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be ok, abnormal, or error' });
    }
    
    // Check if file exists
    if (!fsSync.existsSync(dataFile)) {
      return res.status(404).json({ error: 'No commits found' });
    }
    
    // Read existing data
    const data = await fs.readFile(dataFile, 'utf8');
    let commits = JSON.parse(data);
    
    // Find all commits with this hash (handle duplicates)
    const matchingCommits = commits.filter(c => c.commitHash === hash);
    
    if (matchingCommits.length === 0) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    
    // Update all matching commits
    let updatedCount = 0;
    matchingCommits.forEach(commit => {
      // Initialize statusLog if it doesn't exist
      if (!commit.statusLog) {
        commit.statusLog = [];
      }
      
      // Add status change to log
      commit.statusLog.push({
        previousStatus: commit.status || 'ok',
        newStatus: status,
        changedBy: changedBy || 'System',
        timestamp: new Date().toISOString(),
        reason: 'Manual status change'
      });
      
      // Update status
      commit.status = status;
      commit.manuallyReviewed = true;
      updatedCount++;
    });
    
    // Save updated data
    await fs.writeFile(dataFile, JSON.stringify(commits, null, 2));
    
    res.json({ 
      success: true, 
      message: `Status updated successfully for ${updatedCount} commit(s)` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete a commit
app.delete('/api/commits/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const dataFile = './commit_analysis_history.json';
    
    // Check if file exists
    if (!fsSync.existsSync(dataFile)) {
      return res.status(404).json({ error: 'No commits found' });
    }
    
    // Read existing data
    const data = await fs.readFile(dataFile, 'utf8');
    let commits = JSON.parse(data);
    
    // Find commit index
    const commitIndex = commits.findIndex(c => c.commitHash === hash);
    
    if (commitIndex === -1) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    
    // Remove commit
    commits.splice(commitIndex, 1);
    
    // Save updated data
    await fs.writeFile(dataFile, JSON.stringify(commits, null, 2));
    
    res.json({ success: true, message: 'Commit deleted successfully' });
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