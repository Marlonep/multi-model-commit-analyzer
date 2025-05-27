# Multi-Model Commit Analyzer

AI-powered git commit analyzer that uses multiple language models (GPT-3.5, Claude, Gemini, Grok) to provide comprehensive code quality assessments.

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

- **GPT-3.5 Turbo** (OpenAI)
- **Claude 3 Haiku** (Anthropic)
- **Gemini 1.5 Flash** (Google)
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