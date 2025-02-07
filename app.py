from flask import Flask, render_template, request, jsonify
import os
from flask_sqlalchemy import SQLAlchemy
from openai import OpenAI
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "development_key"

# Initialize database
db = SQLAlchemy(app)

# Initialize OpenAI client
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Import models after db initialization
from models import Task, Block

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': task.id,
        'name': task.name,
        'created_at': task.created_at.isoformat(),
        'updated_at': task.updated_at.isoformat()
    } for task in tasks])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    task = Task(
        name=data.get('name', 'Untitled Task')
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({
        'id': task.id,
        'name': task.name,
        'created_at': task.created_at.isoformat(),
        'updated_at': task.updated_at.isoformat()
    })

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.json
    task.name = data.get('name', task.name)
    task.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({
        'id': task.id,
        'name': task.name,
        'created_at': task.created_at.isoformat(),
        'updated_at': task.updated_at.isoformat()
    })

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    task.is_active = False  # Soft delete
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/tasks/all', methods=['DELETE'])
def delete_all_tasks():
    try:
        # Soft delete all tasks
        Task.query.update({Task.is_active: False})
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting all tasks: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>/blocks', methods=['POST'])
def save_blocks(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.json
    blocks = data.get('blocks', [])

    # Delete existing blocks
    Block.query.filter_by(task_id=task_id).delete()

    def save_block(block_data, parent_id=None, order=0):
        block = Block(
            task_id=task_id,
            type=block_data['type'],
            name=block_data.get('name'),
            data=block_data.get('data'),
            parent_id=parent_id,
            order=order
        )
        db.session.add(block)
        db.session.flush()  # Get block.id

        if block_data['type'] == 'loop' and 'blocks' in block_data:
            for i, child_data in enumerate(block_data['blocks']):
                save_block(child_data, block.id, i)

    for i, block_data in enumerate(blocks):
        save_block(block_data, None, i)

    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>/blocks', methods=['GET'])
def get_blocks(task_id):
    task = Task.query.get_or_404(task_id)

    def format_block(block):
        data = {
            'id': block.id,
            'type': block.type,
            'name': block.name,
            'data': block.data,
            'order': block.order
        }
        if block.type == 'loop':
            data['blocks'] = [format_block(child) for child in sorted(block.children, key=lambda x: x.order)]
        return data

    blocks = Block.query.filter_by(task_id=task_id, parent_id=None).order_by(Block.order).all()
    return jsonify([format_block(block) for block in blocks])

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
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)