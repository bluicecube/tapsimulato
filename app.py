from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import os
from flask_sqlalchemy import SQLAlchemy
from openai import OpenAI
from werkzeug.security import generate_password_hash, check_password_hash
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

# Initialize login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize OpenAI client
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Import models after db initialization
from models import User, Task, Block

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))

        flash('Invalid email or password')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')

        if User.query.filter_by(email=email).first():
            flash('Email already registered')
            return redirect(url_for('register'))

        user = User(
            email=email,
            username=username,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()

        login_user(user)
        return redirect(url_for('index'))

    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    tasks = Task.query.filter_by(owner_id=current_user.id, is_active=True).all()
    return jsonify([{
        'id': task.id,
        'name': task.name,
        'created_at': task.created_at.isoformat(),
        'updated_at': task.updated_at.isoformat()
    } for task in tasks])

@app.route('/api/tasks', methods=['POST'])
@login_required
def create_task():
    data = request.json
    task = Task(
        name=data.get('name', 'Untitled Task'),
        owner_id=current_user.id
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
@login_required
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

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

@app.route('/api/tasks/<int:task_id>/blocks', methods=['POST'])
@login_required
def save_blocks(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

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
@login_required
def get_blocks(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

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
@login_required
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