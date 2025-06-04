import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AIModels } from './analyzeCommit.js';
import { authenticateUser, verifyToken, requireAuth } from './auth.js';
import { dbHelpers } from './database.js';
import cookieParser from 'cookie-parser';
import session from 'express-session';

const execAsync = promisify(exec);

// Middleware to require admin role
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    
    next();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files that don't need auth (login assets)
app.get('/login', (req, res) => {
    const loginPath = path.join(__dirname, 'public', 'login.html');
    res.sendFile(loginPath);
});

app.get('/login.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.js'));
});

app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

// Serve tools data JSON file (public endpoint)
app.get('/tools-data.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'tools-data.json'));
});

// Authentication middleware for all other routes
app.use((req, res, next) => {
    // Allow access to login API endpoints and favicon
    if (req.path.startsWith('/api/login') ||
        req.path.startsWith('/api/verify') ||
        req.path === '/favicon.ico') {
        return next();
    }
    
    // Check session first
    if (req.session && req.session.userId) {
        req.user = { 
            id: req.session.userId, 
            username: req.session.username,
            role: req.session.role 
        };
        return next();
    }
    
    // Check for token in Authorization header (for API calls)
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
            return next();
        }
    }
    
    // No valid auth, handle based on request type
    if (req.path === '/' || req.path.endsWith('.html')) {
        res.redirect('/login');
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

// Serve static files after auth check
app.use(express.static('public'));

// Redirect root to analytics
app.get('/', (req, res) => {
    res.redirect('/analytics.html');
});

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
        
        // Set session
        req.session.userId = result.user.id;
        req.session.username = result.user.username;
        req.session.role = result.user.role;
        req.session.save();
        
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

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true });
    });
});

// API endpoint to get commit history
app.get('/api/commits', async (req, res) => {
  try {
    const history = dbHelpers.getAllCommits(req.user.role, req.user.id, req.user.username);
    
    // Transform database format to match frontend expectations
    const transformedHistory = history.map(commit => ({
      commitHash: commit.commit_hash,
      user: commit.user_name,
      author: commit.user_name,
      project: commit.project,
      organization: commit.organization,
      commitMessage: commit.commit_message,
      timestamp: commit.timestamp,
      fileChanges: commit.file_changes,
      linesAdded: commit.lines_added,
      linesDeleted: commit.lines_deleted,
      averageCodeQuality: commit.average_code_quality,
      averageDevLevel: commit.average_dev_level,
      averageComplexity: commit.average_complexity,
      averageEstimatedHours: commit.average_estimated_hours,
      averageEstimatedHoursWithAi: commit.average_estimated_hours_with_ai,
      averageAiPercentage: commit.average_ai_percentage,
      totalCost: commit.total_cost,
      tokensUsed: commit.tokens_used,
      status: commit.status,
      manuallyReviewed: commit.manually_reviewed,
      statusLog: JSON.parse(commit.status_log || '[]'),
      fileAnalyses: JSON.parse(commit.analysis_details || '{}').fileAnalyses || []
    }));
    
    res.json(transformedHistory);
  } catch (error) {
    console.error('Error fetching commits:', error);
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
    const index = parseInt(req.params.index);
    const commit = dbHelpers.getCommitByIndex(index, req.user.role, req.user.id, req.user.username);
    
    if (commit) {
      // Transform database format to match frontend expectations
      const analysisDetails = JSON.parse(commit.analysis_details || '{}');
      
      // Get model scores from dedicated column or fallback to originalData (backward compatibility)
      let modelScores = [];
      if (commit.model_scores) {
        modelScores = JSON.parse(commit.model_scores);
      } else if (analysisDetails.originalData?.modelScores) {
        modelScores = analysisDetails.originalData.modelScores;
      }
      
      // Get code analysis from originalData if available
      const codeAnalysis = analysisDetails.originalData?.codeAnalysis || null;
      
      const transformedCommit = {
        commitHash: commit.commit_hash,
        user: commit.user_name,
        author: commit.user_name,
        project: commit.project,
        organization: commit.organization,
        commitMessage: commit.commit_message,
        timestamp: commit.timestamp,
        fileChanges: commit.file_changes,
        linesAdded: commit.lines_added,
        linesDeleted: commit.lines_deleted,
        averageCodeQuality: commit.average_code_quality,
        averageDevLevel: commit.average_dev_level,
        averageComplexity: commit.average_complexity,
        averageEstimatedHours: commit.average_estimated_hours,
        averageEstimatedHoursWithAi: commit.average_estimated_hours_with_ai,
        averageAiPercentage: commit.average_ai_percentage,
        totalCost: commit.total_cost,
        tokensUsed: commit.tokens_used,
        status: commit.status,
        manuallyReviewed: commit.manually_reviewed,
        statusLog: JSON.parse(commit.status_log || '[]'),
        fileAnalyses: analysisDetails.fileAnalyses || [],
        modelScores: modelScores,
        codeAnalysis: codeAnalysis
      };
      
      res.json(transformedCommit);
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (error) {
    console.error('Error fetching commit by index:', error);
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
        username: 'Nuclea-Solutions',
        repository: 'multi-model-commit-analyzer',
        baseUrl: 'https://github.com/Nuclea-Solutions/multi-model-commit-analyzer'
      });
    }
  } catch (error) {
    // Fallback configuration on error
    res.json({
      username: 'Nuclea-Solutions',
      repository: 'multi-model-commit-analyzer',
      baseUrl: 'https://github.com/Nuclea-Solutions/multi-model-commit-analyzer'
    });
  }
});

// API endpoint to test AI models
app.post('/api/test-models', requireAdmin, async (req, res) => {
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
app.put('/api/commits/:hash/status', requireAdmin, async (req, res) => {
  try {
    const { hash } = req.params;
    const { status, changedBy } = req.body;
    
    // Validate status
    if (!['ok', 'abnormal', 'error'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be ok, abnormal, or error' });
    }
    
    // Update commit status using database helper
    const result = dbHelpers.updateCommitStatus(hash, status, changedBy);
    
    if (!result || result.changes === 0) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    
    res.json({ 
      success: true, 
      message: `Status updated successfully for commit ${hash}` 
    });
  } catch (error) {
    console.error('Error updating commit status:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete a commit
app.delete('/api/commits/:hash', requireAdmin, async (req, res) => {
  try {
    const { hash } = req.params;
    
    // Delete commit using database helper
    const result = dbHelpers.deleteCommit(hash);
    
    if (!result || result.changes === 0) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    
    res.json({ success: true, message: 'Commit deleted successfully' });
  } catch (error) {
    console.error('Error deleting commit:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get all user details (for dropdowns, etc.)
app.get('/api/users/all/details', async (req, res) => {
  try {
    // Get all users from database
    const users = dbHelpers.getAllUsers();
    const allUserDetails = {};
    
    // Get details for each user
    for (const user of users) {
      const details = dbHelpers.getUserDetails(user.id);
      
      // Use username as key for compatibility with frontend
      allUserDetails[user.username] = {
        email: details?.email || '',
        phone: details?.phone || '',
        whatsappAvailable: details?.whatsapp_available || false,
        minHoursPerDay: details?.min_hours_per_day || 8,
        organizations: details?.organizations || [],
        tools: details?.tools || []
      };
    }
    
    res.json(allUserDetails);
  } catch (error) {
    console.error('Error reading user details:', error);
    res.status(500).json({ error: 'Failed to load user details' });
  }
});

// API endpoint to get user details
app.get('/api/users/:username/details', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if user is accessing their own details or if they are admin
    if (req.user.role === 'user' && req.user.username.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get user details from database
    let userDetails = dbHelpers.getUserDetailsByUsername(username);
    
    // Return default empty object if not found
    if (!userDetails) {
      userDetails = {
        email: '',
        phone: '',
        whatsappAvailable: false,
        minHoursPerDay: 8,
        organizations: [],
        tools: []
      };
    } else {
      // Transform database format to match frontend expectations
      userDetails = {
        email: userDetails.email || '',
        phone: userDetails.phone || '',
        whatsappAvailable: userDetails.whatsapp_available || false,
        minHoursPerDay: userDetails.min_hours_per_day || 8,
        organizations: userDetails.organizations || [],
        tools: userDetails.tools || []
      };
    }
    
    res.json(userDetails);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// API endpoint to update user details
app.put('/api/users/:username/details', async (req, res) => {
  try {
    const { username } = req.params;
    const userDetails = req.body;
    
    // Check if user is updating their own details or if they are admin
    if (req.user.role === 'user' && req.user.username.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Validate input
    if (!userDetails || typeof userDetails !== 'object') {
      return res.status(400).json({ error: 'Invalid user details provided' });
    }
    
    // Validate required fields
    if (!('email' in userDetails) || !('phone' in userDetails) || 
        !('whatsappAvailable' in userDetails) || !('organizations' in userDetails)) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, phone, whatsappAvailable, organizations' 
      });
    }
    
    // Get user to find user ID
    const user = dbHelpers.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user details in database
    const result = dbHelpers.createOrUpdateUserDetails(user.id, {
      email: userDetails.email || '',
      phone: userDetails.phone || '',
      whatsapp_available: Boolean(userDetails.whatsappAvailable),
      min_hours_per_day: typeof userDetails.minHoursPerDay === 'number' ? userDetails.minHoursPerDay : 8,
      organizations: Array.isArray(userDetails.organizations) ? userDetails.organizations : [],
      tools: userDetails.tools || []
    });
    
    res.json({ 
      success: true, 
      message: 'User details updated successfully',
      details: {
        email: userDetails.email || '',
        phone: userDetails.phone || '',
        whatsappAvailable: Boolean(userDetails.whatsappAvailable),
        minHoursPerDay: typeof userDetails.minHoursPerDay === 'number' ? userDetails.minHoursPerDay : 8,
        organizations: Array.isArray(userDetails.organizations) ? userDetails.organizations : [],
        tools: userDetails.tools || []
      }
    });
  } catch (error) {
    console.error('Error updating user details:', error);
    res.status(500).json({ error: 'Failed to update user details' });
  }
});

// API endpoint to get system users
app.get('/api/system-users', requireAdmin, async (req, res) => {
  try {
    const users = dbHelpers.getAllUsers();
    
    // Sanitize users (don't send passwords)
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: user.created_at,
      status: user.status
    }));
    
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error loading system users:', error);
    res.status(500).json({ error: 'Failed to load system users' });
  }
});

// API endpoint to create a new user
app.post('/api/system-users', requireAdmin, async (req, res) => {
  try {
    const bcrypt = await import('bcryptjs');
    const { username, password, name, role } = req.body;
    
    // Validate required fields
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin or user' });
    }
    
    // Check if user already exists
    const existingUser = dbHelpers.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Create the user
    const result = dbHelpers.createUser({
      username,
      password_hash,
      name,
      role,
      status: 'active'
    });
    
    const newUser = {
      id: result.lastInsertRowid,
      username,
      name,
      role,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    res.json({ success: true, user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// API endpoint to update a user
app.put('/api/system-users/:userId', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { username, password, name, role } = req.body;
    
    // Validate required fields (password is optional for updates)
    if (!username || !name || !role) {
      return res.status(400).json({ error: 'Username, name, and role are required' });
    }
    
    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin or user' });
    }
    
    // Check if user exists
    const existingUser = dbHelpers.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prepare update data
    const updateData = { username, name, role, status: 'active' };
    
    // Hash password if provided
    if (password) {
      const bcrypt = await import('bcryptjs');
      const saltRounds = 10;
      updateData.password_hash = await bcrypt.hash(password, saltRounds);
    }
    
    // Update the user
    const result = dbHelpers.updateUser(userId, updateData);
    
    if (!result || result.changes === 0) {
      return res.status(400).json({ error: 'Failed to update user' });
    }
    
    const updatedUser = {
      id: userId,
      username,
      name,
      role,
      status: 'active'
    };
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
});

// API endpoint to delete a user
app.delete('/api/system-users/:userId', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check if user exists
    const existingUser = dbHelpers.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow deleting the only admin user
    if (existingUser.role === 'admin') {
      const allUsers = dbHelpers.getAllUsers();
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only admin user' });
      }
    }
    
    // Delete the user
    const result = dbHelpers.deleteUser(userId);
    
    if (!result || result.changes === 0) {
      return res.status(400).json({ error: 'Failed to delete user' });
    }
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// API endpoint to get daily commits data
app.get('/api/daily-commits', async (req, res) => {
  try {
    const dailyCommits = dbHelpers.getAllDailyCommits();
    
    // Transform database format to match frontend expectations
    const transformedDailyCommits = dailyCommits.map(daily => ({
      date: daily.date,
      user: daily.user_name,
      commitCount: daily.total_commits,
      totalLinesAdded: daily.total_lines_added,
      totalLinesDeleted: daily.total_lines_deleted,
      totalHours: daily.total_hours,
      avgCodeQuality: daily.average_quality,
      avgComplexity: daily.average_complexity,
      avgDevLevel: daily.average_dev_level || 0,
      projects: JSON.parse(daily.projects || '[]'),
      commitHashes: JSON.parse(daily.commit_hashes || '[]'),
      commitIndices: JSON.parse(daily.commit_indices || '[]'),
      summary: daily.summary
    }));
    
    res.json({ dailyCommits: transformedDailyCommits });
  } catch (error) {
    console.error('Error fetching daily commits:', error);
    res.status(500).json({ error: 'Failed to fetch daily commits' });
  }
});

// API endpoint to generate daily report
app.post('/api/generate-daily-report', requireAdmin, async (req, res) => {
  try {
    // Import the generateDailyReport function
    const { generateDailyReport } = await import('./generateDailyReport.js');
    
    // Get optional date parameter from request body
    const { date } = req.body;
    
    // Run the report generation
    const result = await generateDailyReport(date);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Daily report generated successfully',
        daysProcessed: result.daysProcessed,
        summariesGenerated: result.summariesGenerated
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate daily report'
      });
    }
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to generate daily report' 
    });
  }
});

// Tools API endpoints

// Get all tools
app.get('/api/tools', async (req, res) => {
  try {
    const tools = dbHelpers.getAllTools();
    
    // Transform database format to match frontend expectations
    const transformedTools = tools.map(tool => ({
      id: tool.tool_id,
      image: tool.image,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      price: tool.price,
      costPerMonth: tool.cost_per_month,
      website: tool.website
    }));
    
    res.json({ tools: transformedTools });
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// Create a new tool (admin only)
app.post('/api/tools', requireAdmin, async (req, res) => {
  try {
    const toolData = req.body;
    
    // Validate required fields
    if (!toolData.name || !toolData.category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    
    // Generate unique tool_id if not provided
    if (!toolData.tool_id && !toolData.id) {
      toolData.tool_id = 'tool_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    const result = dbHelpers.createTool(toolData, req.user.id);
    
    const newTool = {
      id: toolData.tool_id || toolData.id,
      image: toolData.image,
      name: toolData.name,
      category: toolData.category,
      description: toolData.description,
      price: toolData.price,
      costPerMonth: toolData.costPerMonth || toolData.cost_per_month,
      website: toolData.website
    };
    
    res.json({ success: true, tool: newTool });
  } catch (error) {
    console.error('Error creating tool:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Tool ID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create tool' });
    }
  }
});

// Update a tool (admin only)
app.put('/api/tools/:id', requireAdmin, async (req, res) => {
  try {
    const toolId = parseInt(req.params.id);
    const toolData = req.body;
    
    // Check if tool exists
    const existingTool = dbHelpers.getToolById(toolId);
    if (!existingTool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    // Update the tool
    const result = dbHelpers.updateTool(toolId, toolData);
    
    if (!result || result.changes === 0) {
      return res.status(400).json({ error: 'Failed to update tool' });
    }
    
    res.json({ success: true, message: 'Tool updated successfully' });
  } catch (error) {
    console.error('Error updating tool:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// Delete a tool (admin only)
app.delete('/api/tools/:id', requireAdmin, async (req, res) => {
  try {
    const toolId = parseInt(req.params.id);
    
    // Check if tool exists
    const existingTool = dbHelpers.getToolById(toolId);
    if (!existingTool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    // Delete the tool
    const result = dbHelpers.deleteTool(toolId);
    
    if (!result || result.changes === 0) {
      return res.status(400).json({ error: 'Failed to delete tool' });
    }
    
    res.json({ success: true, message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Error deleting tool:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// Organization API endpoints

// Get all organizations
app.get('/api/organizations', async (req, res) => {
  try {
    const organizations = dbHelpers.getAllOrganizations();
    
    // Add statistics for each organization
    const orgsWithStats = organizations.map(org => {
      const commits = dbHelpers.getCommitsByOrganizationId(org.id);
      const members = dbHelpers.getOrganizationMembers(org.id);
      
      return {
        ...org,
        stats: {
          totalCommits: commits.length,
          totalMembers: members.length,
          averageQuality: commits.length > 0 ? 
            commits.reduce((sum, c) => sum + c.average_code_quality, 0) / commits.length : 0,
          totalLinesAdded: commits.reduce((sum, c) => sum + (c.lines_added || 0), 0),
          totalLinesDeleted: commits.reduce((sum, c) => sum + (c.lines_deleted || 0), 0)
        }
      };
    });
    
    res.json(orgsWithStats);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get organization by ID or slug
app.get('/api/organizations/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let organization = dbHelpers.getOrganizationById(parseInt(identifier));
    if (!organization) {
      organization = dbHelpers.getOrganizationBySlug(identifier);
    }
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Get additional data
    const members = dbHelpers.getOrganizationMembers(organization.id);
    const commits = dbHelpers.getCommitsByOrganizationId(organization.id);
    
    // Parse tech_stack JSON
    if (organization.tech_stack) {
      try {
        organization.tech_stack = JSON.parse(organization.tech_stack);
      } catch (e) {
        organization.tech_stack = [];
      }
    }
    
    res.json({
      ...organization,
      members,
      stats: {
        totalCommits: commits.length,
        totalMembers: members.length,
        averageQuality: commits.length > 0 ? 
          commits.reduce((sum, c) => sum + c.average_code_quality, 0) / commits.length : 0,
        totalLinesAdded: commits.reduce((sum, c) => sum + (c.lines_added || 0), 0),
        totalLinesDeleted: commits.reduce((sum, c) => sum + (c.lines_deleted || 0), 0),
        recentCommits: commits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Create new organization (admin only)
app.post('/api/organizations', requireAdmin, async (req, res) => {
  try {
    const orgData = req.body;
    
    // Validate required fields
    if (!orgData.name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    
    // Generate slug if not provided
    if (!orgData.slug) {
      orgData.slug = orgData.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    
    // Check if organization already exists
    const existing = dbHelpers.getOrganizationByName(orgData.name) || 
                    dbHelpers.getOrganizationBySlug(orgData.slug);
    if (existing) {
      return res.status(400).json({ error: 'Organization already exists' });
    }
    
    const result = dbHelpers.createOrganization(orgData);
    const newOrg = dbHelpers.getOrganizationById(result.lastInsertRowid);
    
    res.json({ success: true, organization: newOrg });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Update organization (admin only)
app.put('/api/organizations/:id', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const orgData = req.body;
    
    // Check if organization exists
    const existing = dbHelpers.getOrganizationById(orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const result = dbHelpers.updateOrganization(orgId, orgData);
    if (result.changes === 0) {
      return res.status(400).json({ error: 'No changes made' });
    }
    
    const updatedOrg = dbHelpers.getOrganizationById(orgId);
    res.json({ success: true, organization: updatedOrg });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Delete organization (admin only)
app.delete('/api/organizations/:id', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    
    // Check if organization exists
    const existing = dbHelpers.getOrganizationById(orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Soft delete
    const result = dbHelpers.deleteOrganization(orgId);
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to delete organization' });
    }
    
    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// Add user to organization
app.post('/api/organizations/:id/members', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const { userId, role, department } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const result = dbHelpers.addUserToOrganization(userId, orgId, role, department);
    res.json({ success: true, message: 'User added to organization' });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    res.status(500).json({ error: 'Failed to add user to organization' });
  }
});

// Remove user from organization
app.delete('/api/organizations/:id/members/:userId', requireAdmin, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    const result = dbHelpers.removeUserFromOrganization(userId, orgId);
    res.json({ success: true, message: 'User removed from organization' });
  } catch (error) {
    console.error('Error removing user from organization:', error);
    res.status(500).json({ error: 'Failed to remove user from organization' });
  }
});

// Get user's organizations
app.get('/api/users/:userId/organizations', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const organizations = dbHelpers.getUserOrganizations(userId);
    res.json(organizations);
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    res.status(500).json({ error: 'Failed to fetch user organizations' });
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