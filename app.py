import os
import logging
from flask import Flask, render_template, request, jsonify
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "development_key"

# Initialize OpenAI client
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        logger.debug(f"Received chat request with data: {data}")

        if not data or 'messages' not in data:
            return jsonify({'error': 'Invalid request data'}), 400

        messages = data['messages']
        if not isinstance(messages, list):
            return jsonify({'error': 'Invalid messages format'}), 400

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )

        logger.debug(f"OpenAI API response: {response}")

        return jsonify({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response.choices[0].message.content
                }
            }]
        })

    except Exception as e:
        error_msg = f"Error in chat endpoint: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)