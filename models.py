from extensions import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON, BYTEA

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    blocks = db.relationship('Block', backref='task', lazy=True, 
                           primaryjoin="and_(Task.id==Block.task_id, Block.parent_id==None)",
                           cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Task {self.name}>'

class Block(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'tap', 'loop', 'function', or 'conditional'
    name = db.Column(db.String(100))
    data = db.Column(JSON)  # Store block-specific data
    reference_image = db.Column(BYTEA, nullable=True)  # Store reference image for conditional blocks
    parent_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    order = db.Column(db.Integer, default=0)
    children = db.relationship('Block', backref=db.backref('parent', remote_side=[id]), 
                             cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Block {self.type} for Task {self.task_id}>'

    def to_dict(self):
        """Convert block to dictionary format"""
        result = {
            'id': self.id,
            'type': self.type,
            'name': self.name,
            'data': self.data or {},
            'order': self.order
        }

        if self.children:
            result['blocks'] = [child.to_dict() for child in sorted(self.children, key=lambda x: x.order)]

        return result

class Function(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    blocks = db.Column(JSON)  # Store function blocks structure
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<Function {self.name}>'