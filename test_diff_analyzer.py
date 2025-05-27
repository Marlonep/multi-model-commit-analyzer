#!/usr/bin/env python3
import subprocess
import sys

# Simulate user input
# Select user #1 (john.doe), project #1 (Acme Corp), diff file #1
user_input = "1\n1\n1\n"

# Run the script with simulated input
process = subprocess.Popen(
    [sys.executable, "ai_diff_analyzer.py"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

output, _ = process.communicate(input=user_input)
print(output)