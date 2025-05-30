# Multi-Model Commit Analyzer

AI-powered git commit analyzer that uses multiple language models (OpenAI o3, Claude Sonnet 4, Gemini 2.5 Pro, Grok) to provide comprehensive code quality assessments.

## Features

- Analyzes git commits using 4 different AI models concurrently
- Provides decimal precision scoring for nuanced evaluation
- Tracks commit analysis history in JSON format
- Estimates AI-generated code percentage
- Calculates time savings when using AI tools
- Evaluates:
  - Code Quality (1.0-5.0 scale)
  - Developer Level (1.0-3.0: Junior/Mid/Senior)
  - Code Complexity (1.0-5.0 scale)
  - Estimated Development Hours
  - AI Code Percentage (0-100%)
  - Estimated Hours with AI assistance

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Marlonep/multi-model-commit-analyzer.git
cd multi-model-commit-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your API keys:
```
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
GEMINI_API_KEY=your_gemini_key
GROK_API_KEY=your_grok_key
```

## Usage

### Analyze a Git Commit
```bash
node analyzeCommit.js [commit_hash] [user] [project]
```

Example:
```bash
node analyzeCommit.js HEAD john.doe MyProject
```

### Test with Sample Diff
```bash
npm test
# or
node testAnalyzer.js
```

## Output

The analyzer provides:
- Detailed scoring table with all model responses
- Individual model reasoning explanations
- Average scores across all models
- AI code percentage estimation
- Time savings calculation with AI assistance
- Commit history tracking

Results are saved to `commit_analysis_history.json` for future reference.

## Models Used

- **OpenAI o3** (OpenAI)
- **Claude Sonnet 4** (Anthropic)
- **Gemini 2.5 Pro Preview** (Google)
- **Grok 3** (xAI)

## Requirements

- Node.js 18+ 
- Git repository (for commit analysis)
- API keys for each AI service

## Example Output

```
📊 AVERAGE SCORES:
Code Quality: 3.8/5
Developer Level: 2.4/3 (Mid)
Complexity: 3.0/5
Estimated Hours: 3.8
AI Code Percentage: 27.5%
Estimated Hours with AI: 2.6
Time Savings with AI: 1.2 hours (31% reduction)
```

## Web Interface

The analyzer includes a modern web interface for viewing commit analysis history:

### Starting the Web Server
```bash
node server.js
# Server runs on http://localhost:3000
```

### Features
- **Terminal-style dark theme** with classic green-on-black aesthetics
- **Commit history table** with three sections:
  - Basic Information (hash, user, project, files, lines)
  - Analysis Scores (quality, complexity, time estimates)
  - Cost Analysis (token usage and API costs)
- **Detailed analysis view** for each commit showing:
  - Individual model scores and reasoning
  - Code composition breakdown (code vs comments vs documentation)
  - Visual progress bars for code analysis
  - Cost breakdown per model
- **Comprehensive data table** with horizontal scrolling for all metrics

### Code Analysis

The analyzer includes a sophisticated code line analyzer that categorizes your codebase:

#### Line Categories
- **Code Lines**: Actual programming logic and statements
- **Comment Lines**: Single-line and multi-line comments
- **Text/Documentation**: Markdown, text files, and documentation
- **Blank Lines**: Empty lines (excluded from percentage calculations)

#### Supported File Types
- **Code**: `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.go`, `.rs`, `.swift`, `.kt`, `.scala`, `.rb`, `.php`, `.r`, `.vue`, `.svelte`
- **Text**: `.md`, `.txt`, `.rst`, `.adoc`, `.tex`
- **Config**: `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.ini`, `.cfg`, `.conf`, `.properties`, `.env`

#### Target Composition
The analyzer compares your codebase against these targets:
- Code: 70%
- Comments: 10%
- Documentation: 20%

### Cost Tracking

Each API call is tracked for cost analysis:
- **Token usage** per model
- **Cost calculation** based on current pricing
- **Total cost** per commit analysis
- **Running totals** across all analyses

### API Configuration

The analyzer automatically extracts:
- **Username**: From git config or commit author
- **Project name**: From git remote URL
- **Repository details**: From git metadata

## Architecture

The project is built with:
- **Node.js** for the backend analyzer
- **Express.js** for the web server
- **Vanilla JavaScript** for the frontend
- **CSS Variables** for theming
- **Monospace fonts** for terminal aesthetics

## Development

### Project Structure
```
multi-model-commit-analyzer/
├── analyzeCommit.js      # Main analyzer script
├── codeAnalyzer.js       # Code line categorization
├── server.js             # Express web server
├── public/               # Web interface files
│   ├── index.html        # Commit history page
│   ├── details.html      # Analysis details page
│   ├── styles.css        # Terminal-style CSS
│   ├── script.js         # History page logic
│   └── details.js        # Details page logic
├── commit_analysis_history.json  # Analysis database
└── package.json          # Node dependencies
```

### Adding New Models

To add a new AI model:
1. Add the model configuration in `analyzeCommit.js`
2. Add pricing information to `MODEL_PRICING`
3. Implement the API call in the `AIModels` class
4. Update the `.env` file with the new API key

### Customizing the Theme

The terminal theme uses CSS variables defined in `:root`:
```css
--bg-primary: #0d1117;      /* Dark background */
--bg-secondary: #161b22;    /* Container background */
--text-primary: #c9d1d9;    /* Main text */
--text-secondary: #8b949e;  /* Secondary text */
--accent-green: #39ff14;    /* Terminal green */
--border-color: #30363d;    /* Borders */
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.