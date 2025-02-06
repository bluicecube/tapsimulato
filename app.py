from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import requests

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

        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers={
                'Authorization': f'Bearer {os.environ["PERPLEXITY_API_KEY"]}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.1-sonar-small-128k-online',
                'messages': data['messages'],
                'temperature': 0.7,
                'max_tokens': 150,
                'top_p': 0.9,
                'stream': False
            }
        )

        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'API request failed'}), 500

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)