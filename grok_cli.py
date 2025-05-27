import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

def get_grok_response(prompt):
    api_key = os.getenv("GROK_API_KEY")
    
    if not api_key or api_key == "your_grok_api_key_here":
        print("Error: Please set your Grok API key in the .env file")
        print("Edit .env and replace 'your_grok_api_key_here' with your actual API key")
        print("You can get your API key from https://console.x.ai/")
        sys.exit(1)
    
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.x.ai/v1"
    )
    
    try:
        response = client.chat.completions.create(
            model="grok-beta",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python grok_cli.py 'your prompt here'")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    
    print("Sending prompt to Grok...")
    response = get_grok_response(prompt)
    print("\nResponse:")
    print(response)

if __name__ == "__main__":
    main()