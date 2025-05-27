import os
import sys
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor
import time
from datetime import datetime
import re

load_dotenv()

# Fixed lists
USERS = [
    "john.doe",
    "jane.smith",
    "mike.johnson",
    "sarah.williams",
    "david.brown",
    "emily.davis",
    "robert.miller",
    "lisa.anderson",
    "chris.taylor",
    "amanda.wilson"
]

PROJECTS = [
    "Acme Corp",
    "TechVision Inc",
    "DataFlow Systems",
    "CloudNext Solutions",
    "AI Innovations",
    "SecureNet Corp",
    "WebScale Technologies",
    "MobileTech Ltd",
    "Analytics Pro",
    "DevOps Masters"
]

class AIModels:
    def __init__(self):
        self.models = []
        self._setup_models()
    
    def _setup_models(self):
        # OpenAI setup
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key and openai_key != "your_api_key_here":
            self.models.append({
                "name": "OpenAI GPT-3.5 Turbo",
                "provider": "OpenAI",
                "client": OpenAI(),
                "type": "openai"
            })
        
        # Claude setup
        claude_key = os.getenv("CLAUDE_API_KEY")
        if claude_key and claude_key != "your_claude_api_key_here":
            self.models.append({
                "name": "Claude 3 Haiku",
                "provider": "Anthropic",
                "client": Anthropic(api_key=claude_key),
                "type": "claude"
            })
        
        # Gemini setup
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key and gemini_key != "your_gemini_api_key_here":
            genai.configure(api_key=gemini_key)
            self.models.append({
                "name": "Gemini 1.5 Flash",
                "provider": "Google",
                "client": genai.GenerativeModel('gemini-1.5-flash'),
                "type": "gemini"
            })
        
        # Grok setup
        grok_key = os.getenv("GROK_API_KEY")
        if grok_key and grok_key != "your_grok_api_key_here":
            self.models.append({
                "name": "Grok Beta",
                "provider": "xAI",
                "client": OpenAI(api_key=grok_key, base_url="https://api.x.ai/v1"),
                "type": "grok"
            })
    
    def get_response(self, model_info, prompt):
        try:
            start_time = time.time()
            
            if model_info["type"] == "openai":
                response = model_info["client"].chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=1000
                )
                result = response.choices[0].message.content
            
            elif model_info["type"] == "claude":
                response = model_info["client"].messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1000,
                    temperature=0.7,
                    messages=[{"role": "user", "content": prompt}]
                )
                result = response.content[0].text
            
            elif model_info["type"] == "gemini":
                response = model_info["client"].generate_content(prompt)
                result = response.text
            
            elif model_info["type"] == "grok":
                response = model_info["client"].chat.completions.create(
                    model="grok-beta",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=1000
                )
                result = response.choices[0].message.content
            
            elapsed_time = time.time() - start_time
            return {
                "model": model_info["name"],
                "provider": model_info["provider"],
                "response": result,
                "time": f"{elapsed_time:.2f}s"
            }
        
        except Exception as e:
            return {
                "model": model_info["name"],
                "provider": model_info["provider"],
                "response": f"Error: {str(e)}",
                "time": "N/A"
            }
    
    def analyze_diff(self, diff_content, user, project):
        prompt = f"""You are reviewing a git diff file for user '{user}' working on project '{project}'.
        
Please analyze the following diff and provide:
1. A summary of the changes
2. Code quality assessment
3. Potential bugs or issues
4. Security considerations
5. Suggestions for improvement
6. Overall rating (1-10)

Diff content:
{diff_content}
"""
        
        if not self.models:
            print("No AI models configured. Please check your API keys in .env file.")
            return []
        
        print(f"\n🤖 Analyzing diff with {len(self.models)} AI models...\n")
        
        with ThreadPoolExecutor(max_workers=len(self.models)) as executor:
            futures = []
            for model in self.models:
                future = executor.submit(self.get_response, model, prompt)
                futures.append(future)
            
            results = []
            for future in futures:
                results.append(future.result())
        
        return results

def select_from_list(items, item_type):
    print(f"\n{item_type}:")
    for i, item in enumerate(items, 1):
        print(f"{i}. {item}")
    
    while True:
        try:
            choice = int(input(f"\nSelect {item_type.lower()} (1-{len(items)}): "))
            if 1 <= choice <= len(items):
                return items[choice - 1]
            else:
                print(f"Please enter a number between 1 and {len(items)}")
        except ValueError:
            print("Please enter a valid number")

def select_diff_file():
    # Create diffs directory if it doesn't exist
    os.makedirs("diffs", exist_ok=True)
    
    # List all .diff files in the diffs directory
    diff_files = [f for f in os.listdir("diffs") if f.endswith(".diff")]
    
    if not diff_files:
        print("\nNo .diff files found in the 'diffs' directory.")
        return None
    
    print("\nAvailable diff files:")
    for i, file in enumerate(diff_files, 1):
        print(f"{i}. {file}")
    
    while True:
        try:
            choice = int(input(f"\nSelect diff file (1-{len(diff_files)}): "))
            if 1 <= choice <= len(diff_files):
                return os.path.join("diffs", diff_files[choice - 1])
            else:
                print(f"Please enter a number between 1 and {len(diff_files)}")
        except ValueError:
            print("Please enter a valid number")

def save_analysis_to_markdown(user, project, diff_file, results):
    # Create analysis directory if it doesn't exist
    os.makedirs("analysis", exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"analysis/{timestamp}_{user}_{project}_{os.path.basename(diff_file)}.md"
    
    # Read diff content
    with open(diff_file, 'r') as f:
        diff_content = f.read()
    
    # Create markdown content
    content = f"# Diff Analysis Report\n\n"
    content += f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    content += f"**User:** {user}\n"
    content += f"**Project:** {project}\n"
    content += f"**Diff File:** {os.path.basename(diff_file)}\n\n"
    content += f"## Diff Content\n\n```diff\n{diff_content}\n```\n\n"
    content += f"## AI Analysis\n\n"
    
    for response in results:
        content += f"### {response['provider']} - {response['model']}\n\n"
        content += f"**Response time:** {response['time']}\n\n"
        content += f"{response['response']}\n\n"
        content += "---\n\n"
    
    # Write to file
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return filename

def print_response(response):
    print(f"\n{'='*80}")
    print(f"🏢 {response['provider']} - {response['model']} ({response['time']})")
    print(f"{'='*80}")
    print(response['response'])
    print()

def main():
    print("🚀 AI Diff Analyzer")
    print("="*50)
    
    # Select user
    user = select_from_list(USERS, "Users")
    print(f"\n✓ Selected user: {user}")
    
    # Select project
    project = select_from_list(PROJECTS, "Projects")
    print(f"✓ Selected project: {project}")
    
    # Select diff file
    diff_file = select_diff_file()
    if not diff_file:
        print("Please add .diff files to the 'diffs' directory and try again.")
        sys.exit(1)
    
    print(f"✓ Selected diff file: {os.path.basename(diff_file)}")
    
    # Read diff content
    with open(diff_file, 'r') as f:
        diff_content = f.read()
    
    # Initialize AI models and analyze
    ai_models = AIModels()
    results = ai_models.analyze_diff(diff_content, user, project)
    
    # Display results
    print("\n" + "="*80)
    print("🎯 AI ANALYSIS RESULTS")
    print("="*80)
    
    for response in results:
        print_response(response)
    
    # Save to markdown
    filename = save_analysis_to_markdown(user, project, diff_file, results)
    
    print(f"\n✅ Analysis complete!")
    print(f"💾 Report saved to: {filename}")

if __name__ == "__main__":
    main()