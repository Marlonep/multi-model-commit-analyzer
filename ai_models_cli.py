import os
import sys
import asyncio
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor
import time
from datetime import datetime
import re

load_dotenv()

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
                    max_tokens=500
                )
                result = response.choices[0].message.content
            
            elif model_info["type"] == "claude":
                response = model_info["client"].messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=500,
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
                    max_tokens=500
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
    
    def query_all_models(self, prompt):
        if not self.models:
            print("No AI models configured. Please check your API keys in .env file.")
            return []
        
        print(f"\n🤖 Querying {len(self.models)} AI models...\n")
        
        with ThreadPoolExecutor(max_workers=len(self.models)) as executor:
            futures = []
            for model in self.models:
                future = executor.submit(self.get_response, model, prompt)
                futures.append(future)
            
            results = []
            for future in futures:
                results.append(future.result())
        
        return results

def print_response(response):
    print(f"{'='*80}")
    print(f"🏢 {response['provider']} - {response['model']} ({response['time']})")
    print(f"{'='*80}")
    print(response['response'])
    print()

def save_to_markdown(prompt, results):
    # Create responses directory if it doesn't exist
    os.makedirs("responses", exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Clean prompt for filename (remove special characters)
    clean_prompt = re.sub(r'[^\w\s-]', '', prompt)[:50].strip()
    clean_prompt = re.sub(r'[-\s]+', '-', clean_prompt)
    filename = f"responses/{timestamp}_{clean_prompt}.md"
    
    # Create markdown content
    content = f"# AI Models Response\n\n"
    content += f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    content += f"## Prompt\n\n{prompt}\n\n"
    content += f"## Responses\n\n"
    
    for response in results:
        content += f"### {response['provider']} - {response['model']}\n\n"
        content += f"**Response time:** {response['time']}\n\n"
        content += f"{response['response']}\n\n"
        content += "---\n\n"
    
    # Write to file
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return filename

def main():
    if len(sys.argv) < 2:
        print("Usage: python ai_models_cli.py 'your prompt here'")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    
    ai_models = AIModels()
    
    print(f"\n📝 Prompt: {prompt}")
    
    results = ai_models.query_all_models(prompt)
    
    print("\n" + "="*80)
    print("🎯 RESPONSES FROM ALL AI MODELS")
    print("="*80 + "\n")
    
    for response in results:
        print_response(response)
    
    # Save to markdown
    filename = save_to_markdown(prompt, results)
    
    print(f"✅ Completed querying {len(results)} models")
    print(f"💾 Responses saved to: {filename}")

if __name__ == "__main__":
    main()