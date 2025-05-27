#!/usr/bin/env python3
"""
Simple HTTP server version of the Git Commit Analyzer
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import cgi
from datetime import datetime
from urllib.parse import parse_qs
import re
from typing import Dict, List
from dataclasses import dataclass, asdict
from enum import Enum

# Port configuration
PORT = 8888

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
        lines = commit_diff.split('\n')
        metrics = self._calculate_metrics(lines)
        complexity = self._determine_complexity(metrics)
        quality = self._determine_quality(metrics, lines)
        estimated_time = self._estimate_time(metrics, complexity)
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
        score = 0
        
        if metrics['files_changed'] > 5:
            score += 3
        elif metrics['files_changed'] > 2:
            score += 2
        else:
            score += 1
        
        if metrics['total_changes'] > 500:
            score += 3
        elif metrics['total_changes'] > 200:
            score += 2
        else:
            score += 1
        
        if metrics['functions_added'] > 10:
            score += 3
        elif metrics['functions_added'] > 5:
            score += 2
        else:
            score += 1
        
        if metrics['async_operations'] > 10:
            score += 2
        elif metrics['async_operations'] > 5:
            score += 1
        
        if score >= 8:
            return Complexity.HIGH
        elif score >= 5:
            return Complexity.MEDIUM
        else:
            return Complexity.LOW
    
    def _determine_quality(self, metrics: Dict[str, int], lines: List[str]) -> CodeQuality:
        quality_score = 0
        
        if metrics['error_handling'] > 0:
            quality_score += 2
        if metrics['validation_logic'] > 0:
            quality_score += 2
        if metrics['typescript_usage'] > 0:
            quality_score += 1
        if metrics['comments'] > metrics['functions_added']:
            quality_score += 1
        
        patterns_found = {
            'proper_typing': bool(re.search(r':\s*(string|number|boolean|any|\w+\[\])', ' '.join(lines))),
            'async_await': metrics['async_operations'] > 0,
            'modular_code': metrics['files_changed'] > 1 and metrics['functions_added'] > 3,
            'validation': metrics['validation_logic'] > 2,
            'error_handling': metrics['error_handling'] > 2
        }
        
        if patterns_found['proper_typing']:
            quality_score += 2
        if patterns_found['modular_code']:
            quality_score += 2
        if patterns_found['validation'] and patterns_found['error_handling']:
            quality_score += 3
        
        if quality_score >= 8:
            return CodeQuality.SENIOR
        elif quality_score >= 4:
            return CodeQuality.MID
        else:
            return CodeQuality.JUNIOR
    
    def _estimate_time(self, metrics: Dict[str, int], complexity: Complexity) -> int:
        base_time = 30
        
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
        
        complexity_multipliers = {
            Complexity.LOW: 1.0,
            Complexity.MEDIUM: 1.3,
            Complexity.HIGH: 1.6
        }
        
        total_time *= complexity_multipliers[complexity]
        total_time += metrics['total_changes'] * 0.5
        
        return int(total_time)
    
    def _generate_feedback(self, metrics: Dict[str, int], complexity: Complexity, quality: CodeQuality) -> str:
        strengths = []
        improvements = []
        
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
        
        if metrics['error_handling'] == 0:
            improvements.append("Add error handling for robustness")
        if metrics['comments'] < metrics['functions_added'] / 2:
            improvements.append("Consider adding more documentation")
        if metrics['test_code'] == 0:
            improvements.append("Add unit tests for new functionality")
        if complexity == Complexity.HIGH and metrics['files_changed'] > 5:
            improvements.append("Consider breaking down into smaller commits")
        
        feedback_parts = []
        
        if strengths:
            feedback_parts.append(f"<strong>Strengths:</strong> {'; '.join(strengths)}")
        
        if improvements:
            feedback_parts.append(f"<strong>Improvements:</strong> {'; '.join(improvements)}")
        
        if not feedback_parts:
            feedback_parts.append("Standard implementation. Consider adding more validation and error handling.")
        
        return '<br>'.join(feedback_parts)

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.serve_html()
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path == '/analyze':
            content_type, _ = cgi.parse_header(self.headers['Content-Type'])
            if content_type == 'multipart/form-data':
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST'}
                )
                
                if 'file' in form:
                    file_item = form['file']
                    if file_item.filename:
                        content = file_item.file.read().decode('utf-8')
                        
                        analyzer = CommitAnalyzer()
                        result = analyzer.analyze_commit(content)
                        result.timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        result.filename = file_item.filename
                        
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps(asdict(result)).encode())
                        return
                
                self.send_error(400, "No file uploaded")
        else:
            self.send_error(404)
    
    def serve_html(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Git Commit Analyzer</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .upload-form { text-align: center; margin: 30px 0; }
        input[type="file"] { margin: 20px 0; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .results { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 4px; display: none; }
        .metric { margin: 10px 0; }
        .metric-label { font-weight: bold; }
        .error { color: red; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Git Commit Analyzer</h1>
        <div class="upload-form">
            <form id="uploadForm">
                <input type="file" id="fileInput" accept=".diff,.patch,.txt" required>
                <br>
                <button type="submit">Analyze Commit</button>
            </form>
        </div>
        <div id="error" class="error"></div>
        <div id="results" class="results"></div>
    </div>
    
    <script>
        document.getElementById('uploadForm').onsubmit = async (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            
            document.getElementById('error').textContent = '';
            document.getElementById('results').style.display = 'none';
            
            try {
                const response = await fetch('/analyze', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Analysis failed');
                
                const data = await response.json();
                
                document.getElementById('results').innerHTML = `
                    <h2>Analysis Results</h2>
                    <div class="metric">
                        <span class="metric-label">Code Complexity:</span> ${data.complexity}
                    </div>
                    <div class="metric">
                        <span class="metric-label">Code Quality:</span> ${data.quality}
                    </div>
                    <div class="metric">
                        <span class="metric-label">Estimated Time:</span> ${data.estimated_minutes} minutes
                    </div>
                    <div class="metric">
                        <span class="metric-label">Changes:</span> +${data.lines_added}/-${data.lines_deleted} (${data.files_changed} files)
                    </div>
                    <div class="metric">
                        <span class="metric-label">Feedback:</span><br>${data.feedback}
                    </div>
                `;
                document.getElementById('results').style.display = 'block';
                
            } catch (err) {
                document.getElementById('error').textContent = 'Error: ' + err.message;
            }
        };
    </script>
</body>
</html>'''
        
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())

def run_server():
    server = HTTPServer(('', PORT), RequestHandler)
    print(f"Server running on http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    server.serve_forever()

if __name__ == '__main__':
    run_server()