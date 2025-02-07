from app import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    blocks = db.relationship('Block', backref='task', lazy=True, cascade='all, delete-orphan')

class Block(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'tap' or 'loop'
    name = db.Column(db.String(100))
    data = db.Column(JSON)  # Store block-specific data (region for tap, iterations for loop)
    parent_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=True)  # For nested blocks
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    order = db.Column(db.Integer, default=0)  # For maintaining block order within a task

    # Relationship for nested blocks (for loop blocks)
    children = db.relationship(
        'Block',
        backref=db.backref('parent', remote_side=[id]),
        cascade='all, delete-orphan'
    )