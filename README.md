# Multi-Model Commit Analyzer

AI-powered git commit analyzer that uses multiple language models (GPT-3.5, Claude, Gemini, Grok) to provide comprehensive code quality assessments.

## Features

- Analyzes git commits using 4 different AI models concurrently
- Provides decimal precision scoring for nuanced evaluation
- Tracks commit analysis history in JSON format
- Evaluates:
  - Code Quality (1.0-5.0 scale)
  - Developer Level (1.0-3.0: Junior/Mid/Senior)
  - Code Complexity (1.0-5.0 scale)
  - Estimated Development Hours

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Marlonep/multi-model-commit-analyzer.git
cd multi-model-commit-analyzer
```

2. Install dependencies:
```bash
pip install -r requirements.txt
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
python analyze_commit_multimodel.py [commit_hash] [user] [project]
```

Example:
```bash
python analyze_commit_multimodel.py HEAD john.doe MyProject
```

### Test with Sample Diff
```bash
python test_multimodel_analyzer.py
```

## Output

The analyzer provides:
- Detailed scoring table with all model responses
- Individual model reasoning explanations
- Average scores across all models
- Commit history tracking

Results are saved to `commit_analysis_history.json` for future reference.

## Models Used

- **GPT-3.5 Turbo** (OpenAI)
- **Claude 3 Haiku** (Anthropic)
- **Gemini 1.5 Flash** (Google)
- **Grok 3** (xAI)

## Requirements

- Python 3.7+
- Git repository (for commit analysis)
- API keys for each AI service