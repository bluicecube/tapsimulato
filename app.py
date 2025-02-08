import os
import cv2
import numpy as np
import base64
from flask import Flask, render_template, request, jsonify
from extensions import db
import logging
from datetime import datetime
from openai import OpenAI

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
db.init_app(app)

# Initialize OpenAI client
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

with app.app_context():
    from models import Task, Block, Function
    db.create_all()

def serialize_block(block):
    """Serialize a block into a dictionary format"""
    data = {
        'id': block.id,
        'type': block.type,
        'name': block.name,
        'data': block.data or {},
        'order': block.order
    }
    return data

def compare_images(img1_data, img2_data):
    """Compare two images and return similarity percentage"""
    # Convert base64 strings to numpy arrays
    img1 = cv2.imdecode(np.frombuffer(base64.b64decode(img1_data), np.uint8), cv2.IMREAD_COLOR)
    img2 = cv2.imdecode(np.frombuffer(base64.b64decode(img2_data), np.uint8), cv2.IMREAD_COLOR)

    # Resize images to same size
    img1 = cv2.resize(img1, (300, 300))
    img2 = cv2.resize(img2, (300, 300))

    # Convert images to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

    # Calculate structural similarity index
    score, _ = cv2.compareHist(gray1, gray2, cv2.HISTCMP_CORREL)

    # Convert to percentage and ensure it's between 0 and 100
    return max(0, min(100, (score + 1) * 50))

@app.route('/')
def index():
    return render_template('index.html')

# Function-related endpoints remain unchanged
@app.route('/api/functions', methods=['GET'])
def get_functions():
    functions = Function.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': func.id,
        'name': func.name,
        'description': func.description,
        'blocks': func.blocks,
        'created_at': func.created_at.isoformat(),
        'updated_at': func.updated_at.isoformat()
    } for func in functions])

@app.route('/api/functions', methods=['POST'])
def create_function():
    data = request.json
    function = Function(
        name=data.get('name', 'Untitled Function'),
        description=data.get('description', ''),
        blocks=data.get('blocks', [])
    )
    db.session.add(function)
    db.session.commit()
    return jsonify({
        'id': function.id,
        'name': function.name,
        'description': function.description,
        'blocks': function.blocks,
        'created_at': function.created_at.isoformat(),
        'updated_at': function.updated_at.isoformat()
    })

@app.route('/api/functions/<int:function_id>', methods=['PUT'])
def update_function(function_id):
    function = Function.query.get_or_404(function_id)
    data = request.json
    function.name = data.get('name', function.name)
    function.description = data.get('description', function.description)
    function.blocks = data.get('blocks', function.blocks)
    function.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({
        'id': function.id,
        'name': function.name,
        'description': function.description,
        'blocks': function.blocks,
        'created_at': function.created_at.isoformat(),
        'updated_at': function.updated_at.isoformat()
    })

@app.route('/api/functions/<int:function_id>', methods=['DELETE'])
def delete_function(function_id):
    function = Function.query.get_or_404(function_id)
    function.is_active = False
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/functions/all', methods=['DELETE'])
def delete_all_functions():
    try:
        Function.query.filter_by(is_active=True).update({'is_active': False})
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting all functions: {str(e)}")
        return jsonify({'error': 'Failed to delete all functions'}), 500

# Task endpoints with improved error handling
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    try:
        tasks = Task.query.filter_by(is_active=True).all()
        return jsonify([{
            'id': task.id,
            'name': task.name,
            'created_at': task.created_at.isoformat(),
            'updated_at': task.updated_at.isoformat()
        } for task in tasks])
    except Exception as e:
        app.logger.error(f"Error getting tasks: {str(e)}")
        return jsonify({'error': 'Failed to load tasks'}), 500

@app.route('/api/tasks', methods=['POST'])
def create_task():
    try:
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
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error creating task: {str(e)}")
        return jsonify({'error': 'Failed to create task'}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    try:
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
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating task: {str(e)}")
        return jsonify({'error': 'Failed to update task'}), 500


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        task = Task.query.get_or_404(task_id)
        task.is_active = False
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting task: {str(e)}")
        return jsonify({'error': 'Failed to delete task'}), 500

@app.route('/api/tasks/all', methods=['DELETE'])
def delete_all_tasks():
    try:
        Task.query.filter_by(is_active=True).update({'is_active': False})
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting all tasks: {str(e)}")
        return jsonify({'error': 'Failed to delete all tasks'}), 500

@app.route('/api/tasks/<int:task_id>/blocks', methods=['GET'])
def get_blocks(task_id):
    try:
        task = Task.query.get_or_404(task_id)
        blocks = Block.query.filter_by(task_id=task_id, parent_id=None).order_by(Block.order).all()
        return jsonify([block.to_dict() for block in blocks])
    except Exception as e:
        logger.error(f"Error getting blocks: {str(e)}")
        return jsonify({'error': 'Failed to load blocks'}), 500

@app.route('/api/tasks/<int:task_id>/blocks', methods=['POST'])
def save_blocks(task_id):
    try:
        task = Task.query.get_or_404(task_id)
        data = request.json
        blocks = data.get('blocks', [])

        # Delete existing blocks
        Block.query.filter_by(task_id=task_id).delete()
        db.session.commit()

        def save_block(block_data, parent_id=None, order=0):
            block = Block(
                task_id=task_id,
                type=block_data['type'],
                name=block_data.get('name'),
                data=block_data.get('data', {}),
                parent_id=parent_id,
                order=order
            )
            db.session.add(block)
            db.session.flush()  # Get the block ID without committing

            # Handle nested blocks
            if block_data.get('blocks'):
                for i, child_data in enumerate(block_data['blocks']):
                    save_block(child_data, block.id, i)

            return block

        # Save new blocks
        for i, block_data in enumerate(blocks):
            save_block(block_data, None, i)

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error saving blocks: {str(e)}")
        return jsonify({'error': 'Failed to save blocks'}), 500

# Other endpoints remain unchanged
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


@app.route('/api/blocks/<int:block_id>/reference-image', methods=['POST'])
def save_reference_image(block_id):
    """Save reference image for a conditional block"""
    block = Block.query.get_or_404(block_id)
    if block.type != 'conditional':
        return jsonify({'error': 'Block is not a conditional block'}), 400

    image_data = request.json.get('image')
    if not image_data:
        return jsonify({'error': 'No image data provided'}), 400

    try:
        # Store base64 encoded image
        block.reference_image = image_data.encode('utf-8')
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error saving reference image: {str(e)}')
        return jsonify({'error': 'Failed to save reference image'}), 500

@app.route('/api/blocks/<int:block_id>/compare-image', methods=['POST'])
def compare_current_image(block_id):
    """Compare current frame with reference image"""
    block = Block.query.get_or_404(block_id)
    if block.type != 'conditional':
        return jsonify({'error': 'Block is not a conditional block'}), 400

    current_image = request.json.get('image')
    if not current_image or not block.reference_image:
        return jsonify({'error': 'Missing image data'}), 400

    try:
        similarity = compare_images(
            block.reference_image.decode('utf-8'),
            current_image
        )
        return jsonify({
            'similarity': similarity,
            'threshold': block.data.get('threshold', 90)
        })
    except Exception as e:
        logger.error(f'Error comparing images: {str(e)}')
        return jsonify({'error': 'Failed to compare images'}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)