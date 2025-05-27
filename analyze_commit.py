#!/usr/bin/env python3
"""
Git Commit Analyzer - Analyzes git commits for complexity, quality, and time estimates
"""

import re
import sys
import subprocess
from typing import Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum


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
    complexity: Complexity
    quality: CodeQuality
    estimated_minutes: int
    feedback: str


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
            complexity=complexity,
            quality=quality,
            estimated_minutes=estimated_time,
            feedback=feedback
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
            total_time += metrics[metric] * factor
        
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
            feedback_parts.append(f"**Strengths:** {'; '.join(strengths)}")
        
        if improvements:
            feedback_parts.append(f"**Improvements:** {'; '.join(improvements)}")
        
        if not feedback_parts:
            feedback_parts.append("Standard implementation. Consider adding more validation and error handling.")
        
        return '\n'.join(feedback_parts)


def get_commit_diff(commit_hash: str = "HEAD") -> str:
    """Get the diff for a specific commit"""
    try:
        # Get the commit diff
        result = subprocess.run(
            ['git', 'show', '--format=', commit_hash],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error getting commit diff: {e}")
        sys.exit(1)


def main():
    """Main entry point"""
    # Get commit hash from arguments or use HEAD
    commit_hash = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    
    # Check if we're in a git repository
    try:
        subprocess.run(['git', 'rev-parse', '--git-dir'], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        print("Error: Not in a git repository")
        sys.exit(1)
    
    # Get commit info
    try:
        commit_info = subprocess.run(
            ['git', 'show', '--format=%h %s', '--no-patch', commit_hash],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        print(f"Error: Could not find commit {commit_hash}")
        sys.exit(1)
    
    print(f"Analyzing commit: {commit_info}\n")
    
    # Get the diff
    diff = get_commit_diff(commit_hash)
    
    if not diff:
        print("No changes found in this commit")
        sys.exit(0)
    
    # Analyze the commit
    analyzer = CommitAnalyzer()
    analysis = analyzer.analyze_commit(diff)
    
    # Print results
    print(f"1. Code complexity: {analysis.complexity.value}")
    print(f"2. Quality of code: {analysis.quality.value}")
    print(f"3. Estimated time to code: {analysis.estimated_minutes} minutes")
    print(f"4. Feedback: {analysis.feedback}")


if __name__ == "__main__":
    main()