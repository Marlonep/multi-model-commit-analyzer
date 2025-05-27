import os
import sys
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

def get_gemini_response(prompt):
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key or api_key == "your_gemini_api_key_here":
        print("Error: Please set your Gemini API key in the .env file")
        print("Edit .env and replace 'your_gemini_api_key_here' with your actual API key")
        print("You can get your API key from https://makersuite.google.com/app/apikey")
        sys.exit(1)
    
    genai.configure(api_key=api_key)
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        return response.text
    
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python gemini_cli.py 'your prompt here'")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    
    print("Sending prompt to Gemini...")
    response = get_gemini_response(prompt)
    print("\nResponse:")
    print(response)

if __name__ == "__main__":
    main()