from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        logger.debug(f"Received chat request with data: {data}")

        # Ensure PERPLEXITY_API_KEY is available
        api_key = os.environ.get("PERPLEXITY_API_KEY")
        if not api_key:
            logger.error("PERPLEXITY_API_KEY not found in environment variables")
            return jsonify({'error': 'API key not configured'}), 500

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': 'llama-3.1-sonar-small-128k-online',
            'messages': data['messages'],
            'temperature': 0.7,
            'max_tokens': 150,
            'top_p': 0.9,
            'stream': False
        }

        logger.debug(f"Sending request to Perplexity API with payload: {payload}")

        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers=headers,
            json=payload
        )

        logger.debug(f"Received response from Perplexity API: Status {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            logger.debug(f"Successful response: {result}")
            return jsonify(result)
        else:
            error_msg = f"API request failed with status {response.status_code}: {response.text}"
            logger.error(error_msg)
            return jsonify({'error': error_msg}), response.status_code

    except requests.exceptions.RequestException as e:
        error_msg = f"Network error when calling Perplexity API: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        error_msg = f"Unexpected error in chat endpoint: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)