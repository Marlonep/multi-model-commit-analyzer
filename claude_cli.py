import os
import sys
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

def get_claude_response(prompt):
    api_key = os.getenv("CLAUDE_API_KEY")
    
    if not api_key or api_key == "your_claude_api_key_here":
        print("Error: Please set your Claude API key in the .env file")
        print("Edit .env and replace 'your_claude_api_key_here' with your actual API key")
        print("You can get your API key from https://console.anthropic.com/")
        sys.exit(1)
    
    client = Anthropic(api_key=api_key)
    
    try:
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            temperature=0.7,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return response.content[0].text
    
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python claude_cli.py 'your prompt here'")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    
    print("Sending prompt to Claude...")
    response = get_claude_response(prompt)
    print("\nResponse:")
    print(response)

if __name__ == "__main__":
    main()