import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// API endpoint to get commit history
app.get('/api/commits', async (req, res) => {
  try {
    const data = await fs.readFile('commit_analysis_history.json', 'utf8');
    const history = JSON.parse(data);
    res.json(history);
  } catch (error) {
    res.json([]);
  }
});

// API endpoint to get specific commit analysis
app.get('/api/commits/:index', async (req, res) => {
  try {
    const data = await fs.readFile('commit_analysis_history.json', 'utf8');
    const history = JSON.parse(data);
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