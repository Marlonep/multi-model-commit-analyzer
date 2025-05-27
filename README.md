# Git Commit Analyzer

A Python script that analyzes git commits to determine code complexity, quality level, and estimated development time.

## Features

- **Complexity Analysis**: Categorizes commits as low, medium, or high complexity
- **Code Quality Assessment**: Identifies code as junior, mid, or senior level
- **Time Estimation**: Estimates development time in minutes
- **Detailed Feedback**: Provides strengths and improvement suggestions

## Usage

```bash
# Analyze the latest commit
python analyze_commit.py

# Analyze a specific commit
python analyze_commit.py <commit-hash>

# Example
python analyze_commit.py e5247db
```

## How It Works

The analyzer examines:
- Number of files changed
- Lines added/deleted
- Code patterns (error handling, validation, TypeScript usage)
- Function definitions
- Async operations
- Test coverage indicators

## Metrics

### Complexity Levels
- **Low**: Simple changes, few files, minimal logic
- **Medium**: Multiple files, moderate logic changes
- **High**: Many files, complex logic, significant refactoring

### Quality Levels
- **Junior**: Basic implementation, minimal error handling
- **Mid**: Good practices, some validation and error handling
- **Senior**: Comprehensive error handling, proper typing, modular design

### Time Estimation
Based on:
- Base time (30 minutes minimum)
- Files changed (15 min/file)
- Functions added (10 min/function)
- Validation logic (5 min/validation)
- Complexity multiplier

## Example Output

```
Analyzing commit: e5247db File upload to ticket and improve validation

1. Code complexity: medium
2. Quality of code: senior
3. Estimated time to code: 210 minutes
4. Feedback: **Strengths:** Good error handling coverage; Comprehensive validation logic; Type safety implementation; Senior-level code patterns and architecture
**Improvements:** Add unit tests for new functionality
```