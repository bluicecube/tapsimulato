from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import logging
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/financials')
def financials():
    return render_template('financials.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        logger.debug(f"Received chat request with data: {data}")

        if not data or 'messages' not in data:
            logger.error("Invalid request data")
            return jsonify({'error': 'Invalid request data'}), 400

        # Ensure the messages array follows the correct format
        messages = data['messages']
        if not messages or not isinstance(messages, list):
            logger.error("Invalid messages format")
            return jsonify({'error': 'Invalid messages format'}), 400

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=500  # Increased from 150 to handle longer responses
        )

        logger.debug(f"OpenAI API response: {response}")

        # Extract the response content
        if not response.choices or not response.choices[0].message:
            logger.error("Invalid response from OpenAI")
            return jsonify({'error': 'Invalid response from OpenAI'}), 500

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