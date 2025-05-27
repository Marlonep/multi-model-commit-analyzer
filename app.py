#!/usr/bin/env python3
"""
Flask web app for Git Commit Analyzer
"""

from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime
from werkzeug.utils import secure_filename
import re
from typing import Dict, List
from dataclasses import dataclass, asdict
from enum import Enum

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# Create uploads directory if it doesn't exist
os.makedirs('uploads', exist_ok=True)

# History file
HISTORY_FILE = 'analysis_history.json'


class Complexity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CodeQuality(Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"


@dataclass
class CommitAnalysis:
    complexity: str
    quality: str
    estimated_minutes: int
    feedback: str
    timestamp: str = ""
    filename: str = ""
    lines_added: int = 0
    lines_deleted: int = 0
    files_changed: int = 0


class CommitAnalyzer:
    def __init__(self):
        self.patterns = {
            'file_changes': r'^\+\+\+|^---',
            'additions': r'^\+(?!\+\+)',
            'deletions': r'^-(?!--)',
            'function_def': r'(function|def|class|interface|type)\s+\w+',
            'validation': r'(validate|check|verify|isValid)',
            'error_handling': r'(try|catch|except|throw|reject|Promise\.(reject|resolve))',
            'tests': r'(test|spec|describe|it\(|expect)',
            'typescript': r'(interface|type|enum|implements|extends)',
            'async': r'(async|await|Promise|then)',
            'comments': r'(//|/\*|\*|#)\s*\w+',
        }
        
    def analyze_commit(self, commit_diff: str) -> CommitAnalysis:
        """Analyze a git commit diff and return metrics"""
        lines = commit_diff.split('\n')
        
        # Count various metrics
        metrics = self._calculate_metrics(lines)
        
        # Determine complexity
        complexity = self._determine_complexity(metrics)
        
        # Determine code quality
        quality = self._determine_quality(metrics, lines)
        
        # Estimate time
        estimated_time = self._estimate_time(metrics, complexity)
        
        # Generate feedback
        feedback = self._generate_feedback(metrics, complexity, quality)
        
        return CommitAnalysis(
            complexity=complexity.value,
            quality=quality.value,
            estimated_minutes=estimated_time,
            feedback=feedback,
            lines_added=metrics['lines_added'],
            lines_deleted=metrics['lines_deleted'],
            files_changed=metrics['files_changed']
        )
    
    def _calculate_metrics(self, lines: List[str]) -> Dict[str, int]:
        """Calculate various metrics from the diff"""
        metrics = {
            'files_changed': 0,
            'lines_added': 0,
            'lines_deleted': 0,
            'functions_added': 0,
            'validation_logic': 0,
            'error_handling': 0,
            'test_code': 0,
            'typescript_usage': 0,
            'async_operations': 0,
            'comments': 0,
            'total_changes': 0
        }
        
        for line in lines:
            if re.match(self.patterns['file_changes'], line):
                metrics['files_changed'] += 1
            elif re.match(self.patterns['additions'], line):
                metrics['lines_added'] += 1
                self._analyze_line_content(line, metrics)
            elif re.match(self.patterns['deletions'], line):
                metrics['lines_deleted'] += 1
        
        metrics['total_changes'] = metrics['lines_added'] + metrics['lines_deleted']
        return metrics
    
    def _analyze_line_content(self, line: str, metrics: Dict[str, int]):
        """Analyze the content of an added line"""
        if re.search(self.patterns['function_def'], line):
            metrics['functions_added'] += 1
        if re.search(self.patterns['validation'], line):
            metrics['validation_logic'] += 1
        if re.search(self.patterns['error_handling'], line):
            metrics['error_handling'] += 1
        if re.search(self.patterns['tests'], line):
            metrics['test_code'] += 1
        if re.search(self.patterns['typescript'], line):
            metrics['typescript_usage'] += 1
        if re.search(self.patterns['async'], line):
            metrics['async_operations'] += 1
        if re.search(self.patterns['comments'], line):
            metrics['comments'] += 1
    
    def _determine_complexity(self, metrics: Dict[str, int]) -> Complexity:
        """Determine the complexity based on metrics"""
        score = 0
        
        # File changes
        if metrics['files_changed'] > 5:
            score += 3
        elif metrics['files_changed'] > 2:
            score += 2
        else:
            score += 1
        
        # Total changes
        if metrics['total_changes'] > 500:
            score += 3
        elif metrics['total_changes'] > 200:
            score += 2
        else:
            score += 1
        
        # Function complexity
        if metrics['functions_added'] > 10:
            score += 3
        elif metrics['functions_added'] > 5:
            score += 2
        else:
            score += 1
        
        # Async operations
        if metrics['async_operations'] > 10:
            score += 2
        elif metrics['async_operations'] > 5:
            score += 1
        
        # Determine complexity level
        if score >= 8:
            return Complexity.HIGH
        elif score >= 5:
            return Complexity.MEDIUM
        else:
            return Complexity.LOW
    
    def _determine_quality(self, metrics: Dict[str, int], lines: List[str]) -> CodeQuality:
        """Determine code quality based on patterns and practices"""
        quality_score = 0
        
        # Good practices
        if metrics['error_handling'] > 0:
            quality_score += 2
        if metrics['validation_logic'] > 0:
            quality_score += 2
        if metrics['typescript_usage'] > 0:
            quality_score += 1
        if metrics['comments'] > metrics['functions_added']:
            quality_score += 1
        
        # Check for patterns
        patterns_found = {
            'proper_typing': bool(re.search(r':\s*(string|number|boolean|any|\w+\[\])', ' '.join(lines))),
            'async_await': metrics['async_operations'] > 0,
            'modular_code': metrics['files_changed'] > 1 and metrics['functions_added'] > 3,
            'validation': metrics['validation_logic'] > 2,
            'error_handling': metrics['error_handling'] > 2
        }
        
        # Add points for senior-level patterns
        if patterns_found['proper_typing']:
            quality_score += 2
        if patterns_found['modular_code']:
            quality_score += 2
        if patterns_found['validation'] and patterns_found['error_handling']:
            quality_score += 3
        
        # Determine quality level
        if quality_score >= 8:
            return CodeQuality.SENIOR
        elif quality_score >= 4:
            return CodeQuality.MID
        else:
            return CodeQuality.JUNIOR
    
    def _estimate_time(self, metrics: Dict[str, int], complexity: Complexity) -> int:
        """Estimate time to code in minutes"""
        base_time = 30  # Base time for any change
        
        # Time per metric
        time_factors = {
            'files_changed': 15,
            'functions_added': 10,
            'validation_logic': 5,
            'error_handling': 5,
            'test_code': 8,
            'async_operations': 3
        }
        
        total_time = base_time
        for metric, factor in time_factors.items():
            total_time += metrics.get(metric, 0) * factor
        
        # Complexity multiplier
        complexity_multipliers = {
            Complexity.LOW: 1.0,
            Complexity.MEDIUM: 1.3,
            Complexity.HIGH: 1.6
        }
        
        total_time *= complexity_multipliers[complexity]
        
        # Add time for lines of code
        total_time += metrics['total_changes'] * 0.5
        
        return int(total_time)
    
    def _generate_feedback(self, metrics: Dict[str, int], complexity: Complexity, quality: CodeQuality) -> str:
        """Generate constructive feedback"""
        strengths = []
        improvements = []
        
        # Identify strengths
        if metrics['error_handling'] > 3:
            strengths.append("Good error handling coverage")
        if metrics['validation_logic'] > 5:
            strengths.append("Comprehensive validation logic")
        if metrics['typescript_usage'] > 0:
            strengths.append("Type safety implementation")
        if quality == CodeQuality.SENIOR:
            strengths.append("Senior-level code patterns and architecture")
        elif quality == CodeQuality.MID:
            strengths.append("Solid implementation with good practices")
        
        # Identify improvements
        if metrics['error_handling'] == 0:
            improvements.append("Add error handling for robustness")
        if metrics['comments'] < metrics['functions_added'] / 2:
            improvements.append("Consider adding more documentation")
        if metrics['test_code'] == 0:
            improvements.append("Add unit tests for new functionality")
        if complexity == Complexity.HIGH and metrics['files_changed'] > 5:
            improvements.append("Consider breaking down into smaller commits")
        
        # Build feedback
        feedback_parts = []
        
        if strengths:
            feedback_parts.append(f"<strong>Strengths:</strong> {'; '.join(strengths)}")
        
        if improvements:
            feedback_parts.append(f"<strong>Improvements:</strong> {'; '.join(improvements)}")
        
        if not feedback_parts:
            feedback_parts.append("Standard implementation. Consider adding more validation and error handling.")
        
        return '<br>'.join(feedback_parts)


def load_history():
    """Load analysis history from file"""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []


def save_history(history):
    """Save analysis history to file"""
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)


@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze uploaded diff file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file content
        content = file.read().decode('utf-8')
        
        # Analyze
        analyzer = CommitAnalyzer()
        result = analyzer.analyze_commit(content)
        
        # Add metadata
        result.timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        result.filename = secure_filename(file.filename)
        
        # Save to history
        history = load_history()
        history.insert(0, asdict(result))  # Add to beginning
        if len(history) > 100:  # Keep only last 100 entries
            history = history[:100]
        save_history(history)
        
        return jsonify(asdict(result))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/history')
def history():
    """Get analysis history"""
    history = load_history()
    return jsonify(history)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)