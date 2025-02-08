// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// State management
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;

// Initialize state
window.state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null,
    focusedBlock: null,
    lastTaskId: localStorage.getItem('lastTaskId'),
    currentFrame: null
};

// Execute task function
function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks) {
        logToConsole('No task to execute', 'error');
        return;
    }
    logToConsole('Starting task execution...', 'info');
}

// Add Logic Block
function addLogicBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'logic',
        name: 'Logic Block',
        data: {
            threshold: 90,
            referenceImage: null,
            thenBlocks: [],
            elseBlocks: []
        }
    };

    if (!state.currentTask.blocks) {
        state.currentTask.blocks = [];
    }

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Added Logic block', 'success');
}

// Add Tap Block
function addTapBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const tapBlock = {
        type: 'tap',
        region: null,
        name: 'Tap Block'
    };

    if (!state.currentTask.blocks) {
        state.currentTask.blocks = [];
    }

    state.currentTask.blocks.push(tapBlock);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Added Tap block', 'success');
}

// Add Loop Block
function addLoopBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const loopBlock = {
        type: 'loop',
        iterations: 1,
        blocks: [],
        name: 'Loop Block'
    };

    if (!state.currentTask.blocks) {
        state.currentTask.blocks = [];
    }

    state.currentTask.blocks.push(loopBlock);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Added Loop block', 'success');
}

// State management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements
    const selectionBox = document.getElementById('selectionBox');
    const simulator = document.getElementById('simulator');
    const taskTitle = document.getElementById('taskTitle');

    // Setup event listeners for task controls
    const executeTaskBtn = document.getElementById('executeTaskBtn');
    const addTapBtn = document.getElementById('addTapBtn');
    const addLoopBtn = document.getElementById('addLoopBtn');
    const addLogicBtn = document.getElementById('addLogicBtn');
    const newTaskBtn = document.getElementById('newTaskBtn');
    const deleteAllTasksBtn = document.getElementById('deleteAllTasksBtn');

    if (executeTaskBtn) {
        executeTaskBtn.addEventListener('click', executeTask);
    }

    if (addTapBtn) {
        addTapBtn.addEventListener('click', addTapBlock);
    }

    if (addLoopBtn) {
        addLoopBtn.addEventListener('click', addLoopBlock);
    }

    if (addLogicBtn) {
        addLogicBtn.addEventListener('click', addLogicBlock);
    }

    if (newTaskBtn) {
        newTaskBtn.addEventListener('click', createNewTask);
    }

    if (deleteAllTasksBtn) {
        deleteAllTasksBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete all tasks?')) {
                try {
                    await fetch('/api/tasks/all', { method: 'DELETE' });
                    state.tasks = [];
                    state.currentTask = null;
                    await createNewTask();
                    updateTaskList();
                    updateTaskDisplay();
                    logToConsole('All tasks deleted', 'success');
                } catch (error) {
                    logToConsole('Error deleting tasks', 'error');
                }
            }
        });
    }

    // Add task title change handler
    if (taskTitle) {
        taskTitle.addEventListener('change', async () => {
            if (state.currentTask) {
                try {
                    const response = await fetch(`/api/tasks/${state.currentTask.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: taskTitle.value
                        })
                    });

                    if (!response.ok) throw new Error('Failed to update task name');

                    const updatedTask = await response.json();
                    const taskIndex = state.tasks.findIndex(t => t.id === updatedTask.id);
                    if (taskIndex !== -1) {
                        state.tasks[taskIndex] = updatedTask;
                        updateTaskList();
                    }

                    logToConsole('Task name updated', 'success');
                } catch (error) {
                    logToConsole('Failed to update task name', 'error');
                }
            }
        });
    }

    // Initialize by loading tasks
    loadTasks().then(() => {
        console.log('Initial state setup complete:', window.state);
    });
});

// Task Management
async function createNewTask() {
    try {
        const nextNumber = state.tasks.length > 0 ? Math.max(...state.tasks.map(t => {
            const match = t.name.match(/^Task (\d+)$/);
            return match ? parseInt(match[1]) : 0;
        })) + 1 : 1;

        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `Task ${nextNumber}`
            })
        });

        if (!response.ok) throw new Error('Failed to create task');

        const task = await response.json();
        state.tasks.push(task);
        state.currentTask = {
            id: task.id,
            blocks: []
        };
        state.lastTaskId = task.id;
        localStorage.setItem('lastTaskId', task.id);

        updateTaskList();
        updateTaskDisplay();

        const taskTitle = document.getElementById('taskTitle');
        if (taskTitle) {
            taskTitle.value = `Task ${nextNumber}`;
        }

        logToConsole('New task created', 'success');
        return task;
    } catch (error) {
        logToConsole('Error creating task', 'error');
        console.error('Error creating task:', error);
        throw error;
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to load tasks');

        state.tasks = await response.json();
        updateTaskList();

        if (state.tasks.length > 0) {
            let taskToLoad = state.tasks[0];
            if (state.lastTaskId) {
                const savedTask = state.tasks.find(t => t.id === parseInt(state.lastTaskId));
                if (savedTask) {
                    taskToLoad = savedTask;
                }
            }
            await loadTask(taskToLoad.id);
        } else {
            await createNewTask();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        logToConsole('Error loading tasks', 'error');
        if (!state.currentTask) {
            await createNewTask();
        }
    }
}

function updateTaskDisplay() {
    const currentTaskElement = document.getElementById('currentTask');
    if (!currentTaskElement) return;

    currentTaskElement.innerHTML = '';

    if (state.currentTask && state.currentTask.blocks) {
        state.currentTask.blocks.forEach(block => {
            const blockElement = createBlockElement(block);
            if (blockElement) {
                currentTaskElement.appendChild(blockElement);
            }
        });
    }
}

function createBlockElement(block) {
    const blockDiv = document.createElement('div');
    blockDiv.className = `block ${block.type}-block`;

    let innerHTML = '';
    switch (block.type) {
        case 'tap':
            innerHTML = `
                <h6 class="mb-2">Tap Block</h6>
                <small class="text-muted">Region: ${block.region ? JSON.stringify(block.region) : 'Not set'}</small>
            `;
            break;
        case 'loop':
            innerHTML = `
                <h6 class="mb-2">Loop Block</h6>
                <div class="input-group mb-2">
                    <span class="input-group-text">Iterations</span>
                    <input type="number" class="form-control iterations-input" value="${block.iterations}" min="1">
                </div>
                <div class="nested-blocks"></div>
            `;
            break;
        case 'logic':
            innerHTML = `
                <h6 class="mb-2">Logic Block</h6>
                <div class="nested-blocks">
                    <div class="then-blocks">Then:</div>
                    <div class="else-blocks">Else:</div>
                </div>
            `;
            break;
    }

    blockDiv.innerHTML = innerHTML;
    return blockDiv;
}

function scheduleAutosave() {
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    state.autoSaveTimeout = setTimeout(async () => {
        try {
            await saveCurrentTask();
            logToConsole('Task autosaved', 'success');
        } catch (error) {
            logToConsole('Failed to autosave task', 'error');
        }
    }, 2000);
}

async function saveCurrentTask() {
    if (!state.currentTask) return;

    try {
        const response = await fetch(`/api/tasks/${state.currentTask.id}/blocks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.currentTask.blocks)
        });

        if (!response.ok) throw new Error('Failed to save task');
    } catch (error) {
        console.error('Error saving task:', error);
        throw error;
    }
}

async function loadTask(taskId) {
    try {
        if (state.currentTask) {
            await saveCurrentTask();
        }

        const response = await fetch(`/api/tasks/${taskId}/blocks`);
        if (!response.ok) throw new Error('Failed to load task blocks');

        const blocks = await response.json();
        state.currentTask = {
            id: taskId,
            blocks: blocks
        };

        updateTaskDisplay();
    } catch (error) {
        console.error('Error loading task:', error);
        logToConsole('Error loading task', 'error');
    }
}

function updateTaskList() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    taskList.innerHTML = '';
    state.tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-list-item';
        if (state.currentTask && task.id === state.currentTask.id) {
            taskElement.classList.add('active');
        }

        taskElement.innerHTML = `
            <span>${task.name}</span>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-danger delete-task-btn">Delete</button>
                <button class="btn btn-sm btn-outline-primary load-task-btn">Load</button>
            </div>
        `;

        taskElement.querySelector('.load-task-btn').addEventListener('click', () => loadTask(task.id));
        taskElement.querySelector('.delete-task-btn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
                    state.tasks = state.tasks.filter(t => t.id !== task.id);
                    if (state.currentTask && state.currentTask.id === task.id) {
                        state.currentTask = null;
                        if (state.tasks.length > 0) {
                            await loadTask(state.tasks[0].id);
                        } else {
                            await createNewTask();
                        }
                    }
                    updateTaskList();
                    logToConsole('Task deleted', 'success');
                } catch (error) {
                    logToConsole('Error deleting task', 'error');
                }
            }
        });

        taskList.appendChild(taskElement);
    });
}

function logToConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    if (!console) return;

    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageEl);
    console.scrollTop = console.scrollHeight;
}