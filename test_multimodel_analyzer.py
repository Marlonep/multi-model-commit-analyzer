#!/usr/bin/env python3
"""
Test script for the multi-model commit analyzer using diff files
"""

import os
import sys
from analyze_commit_multimodel import AIModels, ModelScore, CommitAnalysis, CommitDatabase, print_model_scores_table, print_commit_history_table
from datetime import datetime

def test_with_diff_file():
    # Read a sample diff file
    diff_file = "diffs/feature_user_auth.diff"
    if not os.path.exists(diff_file):
        print(f"Error: {diff_file} not found")
        sys.exit(1)
    
    with open(diff_file, 'r') as f:
        diff_content = f.read()
    
    # Mock commit info
    commit_info = {
        'hash': 'abc123def',
        'message': 'Add user authentication feature',
        'author': 'john.doe',
        'date': '2025-05-22 16:30:00',
        'files_changed': 1,
        'lines_added': 25,
        'lines_deleted': 5
    }
    
    print("🚀 Enhanced Multi-Model Commit Analyzer (Test Mode)")
    print("📝 User: john.doe | Project: TestProject")
    print("="*80)
    print(f"Analyzing commit: {commit_info['hash'][:8]} - {commit_info['message']}")
    print(f"Author: {commit_info['author']} | Date: {commit_info['date']}")
    print(f"Files: {commit_info['files_changed']} | +{commit_info['lines_added']} -{commit_info['lines_deleted']}")
    
    # Initialize AI models and analyze
    ai_models = AIModels()
    print(f"\n🤖 Analyzing with {len(ai_models.models)} AI models...")
    
    if not ai_models.models:
        print("No AI models available. Please check your API keys in .env file.")
        sys.exit(1)
    
    model_scores = ai_models.analyze_commit(diff_content, commit_info)
    
    if not model_scores:
        print("No valid responses from AI models.")
        sys.exit(1)
    
    # Calculate averages
    avg_quality = sum(score.code_quality for score in model_scores) / len(model_scores)
    avg_dev_level = sum(score.dev_level for score in model_scores) / len(model_scores)
    avg_complexity = sum(score.complexity for score in model_scores) / len(model_scores)
    avg_hours = sum(score.estimated_hours for score in model_scores) / len(model_scores)
    avg_ai_percentage = sum(score.ai_percentage for score in model_scores) / len(model_scores)
    avg_hours_with_ai = sum(score.estimated_hours_with_ai for score in model_scores) / len(model_scores)
    
    # Create analysis record
    analysis = CommitAnalysis(
        commit_hash=commit_info['hash'],
        commit_message=commit_info['message'],
        timestamp=datetime.now().isoformat(),
        user="john.doe",
        project="TestProject",
        file_changes=commit_info['files_changed'],
        lines_added=commit_info['lines_added'],
        lines_deleted=commit_info['lines_deleted'],
        model_scores=model_scores,
        average_code_quality=avg_quality,
        average_dev_level=avg_dev_level,
        average_complexity=avg_complexity,
        average_estimated_hours=avg_hours,
        average_ai_percentage=avg_ai_percentage,
        average_estimated_hours_with_ai=avg_hours_with_ai
    )
    
    # Print results
    print_model_scores_table(model_scores)
    
    print(f"\n📊 AVERAGE SCORES:")
    print(f"Code Quality: {avg_quality:.1f}/5")
    print(f"Developer Level: {avg_dev_level:.1f}/3 ({'Junior' if avg_dev_level <= 1.5 else 'Mid' if avg_dev_level <= 2.5 else 'Senior'})")
    print(f"Complexity: {avg_complexity:.1f}/5")
    print(f"Estimated Hours: {avg_hours:.1f}")
    print(f"AI Code Percentage: {avg_ai_percentage:.1f}%")
    print(f"Estimated Hours with AI: {avg_hours_with_ai:.1f}")
    print(f"Time Savings with AI: {avg_hours - avg_hours_with_ai:.1f} hours ({((avg_hours - avg_hours_with_ai) / avg_hours * 100):.0f}% reduction)")
    
    # Save to database and show history
    db = CommitDatabase()
    db.save_analysis(analysis)
    
    print_commit_history_table(db.get_history())
    
    print(f"\n✅ Analysis complete! Saved to {db.db_file}")

if __name__ == "__main__":
    test_with_diff_file()