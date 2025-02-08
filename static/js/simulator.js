// Initialize state
const state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null,
    focusedBlock: null,
    lastTaskId: null
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const selectionBox = document.getElementById('selectionBox');
    const simulator = document.getElementById('simulator');
    const taskTitle = document.getElementById('taskTitle');

    // Set up event listeners
    document.getElementById('executeTaskBtn').addEventListener('click', executeTask);
    document.getElementById('addTapBtn').addEventListener('click', () => addTapBlock());
    document.getElementById('addLoopBtn').addEventListener('click', () => addLoopBlock());
    document.getElementById('addConditionalBtn').addEventListener('click', addConditionalBlock);
    document.getElementById('newTaskBtn').addEventListener('click', async () => { await createNewTask(); });
    document.getElementById('addFunctionTapBtn').addEventListener('click', () => addBlockToFunction('tap'));
    document.getElementById('addFunctionLoopBtn').addEventListener('click', () => addBlockToFunction('loop'));
    document.getElementById('saveFunctionBtn').addEventListener('click', saveFunction);

    // Add task title change handler
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

    // Selection events
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);

    // Listen for mouseup on document to catch out-of-bounds releases
    document.addEventListener('mouseup', (event) => {
        if (isSelecting) {
            const rect = simulator.getBoundingClientRect();
            const simulatorX = event.clientX - rect.left;
            const simulatorY = event.clientY - rect.top;

            // Clamp coordinates to simulator bounds
            const endX = Math.max(0, Math.min(rect.width, simulatorX));
            const endY = Math.max(0, Math.min(rect.height, simulatorY));

            finishSelection(endX, endY);
            isSelecting = false;
        }
    });

    // Continue selection when mouse re-enters simulator
    simulator.addEventListener('mouseenter', (event) => {
        if (isSelecting) {
            updateSelection(event);
        }
    });

    // Setup video sharing
    setupVideoSharing();

    // Load functions and tasks
    loadFunctions();
    // Load tasks when the page loads
    loadTasks().then(() => {
        console.log('Initial tasks loaded');
    }).catch(error => {
        console.error('Failed to load initial tasks:', error);
    });

    // Initialize function modal
    const functionModal = document.getElementById('functionModal');
    if (functionModal) {
        new bootstrap.Modal(functionModal);
    }

    // Add click handler for task list items
    const taskList = document.getElementById('taskList');
    if (taskList) {
        taskList.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-list-item');
            if (taskItem && !e.target.closest('.btn')) {
                const taskId = parseInt(taskItem.dataset.taskId);
                loadTask(taskId);
            }
        });
    }
});

// Task Management
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to load tasks');

        state.tasks = await response.json();
        updateTaskList();

        // Load last task or create new one
        if (state.tasks.length > 0) {
            let taskToLoad;

            // Try to load last opened task
            const lastTaskId = localStorage.getItem('lastTaskId');
            if (lastTaskId) {
                taskToLoad = state.tasks.find(t => t.id === parseInt(lastTaskId));
            }

            // If no last task or it doesn't exist, load most recent
            if (!taskToLoad) {
                taskToLoad = state.tasks[0];
            }

            await loadTask(taskToLoad.id);
        } else {
            await createNewTask();
        }

        logToConsole('Tasks loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading tasks:', error);
        logToConsole('Error loading tasks', 'error');

        // Create new task as fallback
        if (!state.currentTask) {
            await createNewTask();
        }
    }
}

async function createNewTask() {
    try {
        // Find highest task number
        const taskNumbers = state.tasks
            .map(t => {
                const match = t.name.match(/^Task (\d+)$/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(n => !isNaN(n));

        const nextNumber = taskNumbers.length > 0 ? Math.max(...taskNumbers) + 1 : 1;

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

        // Save last opened task ID
        state.lastTaskId = task.id;
        localStorage.setItem('lastTaskId', task.id);

        updateTaskList();
        updateTaskDisplay();

        logToConsole('New task created', 'success');
        return task;
    } catch (error) {
        logToConsole('Error creating task', 'error');
        throw error;
    }
}

// Task list update function
function updateTaskList() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    taskList.innerHTML = state.tasks.map(task => `
        <div class="task-list-item ${state.currentTask && state.currentTask.id === task.id ? 'active' : ''}" 
             data-task-id="${task.id}">
            <span>${task.name}</span>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-danger delete-task-btn" 
                        onclick="deleteTask(${task.id})" title="Delete task">×</button>
            </div>
        </div>
    `).join('');
}

// Task loading function
async function loadTask(taskId) {
    try {
        // Save current task before loading new one
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

        // Save last opened task ID
        localStorage.setItem('lastTaskId', taskId);

        const taskTitle = document.getElementById('taskTitle');
        const currentTask = state.tasks.find(t => t.id === taskId);
        if (currentTask) {
            taskTitle.value = currentTask.name || '';
        }

        updateTaskDisplay();
        updateTaskList();
        logToConsole(`Loaded task ${taskId}`, 'success');
    } catch (error) {
        logToConsole('Error loading task blocks', 'error');
        console.error('Load task error:', error);
    }
}

// UI Updates
function updateTaskDisplay() {
    const currentTaskElement = document.getElementById('currentTask');
    const taskTitle = document.getElementById('taskTitle');
    if (!currentTaskElement) return;

    currentTaskElement.innerHTML = '';
    if (state.currentTask) {
        taskTitle.value = state.tasks.find(t => t.id === state.currentTask.id)?.name || '';
    }

    if (state.currentTask && state.currentTask.blocks) {
        state.currentTask.blocks.forEach((block, index) => {
            currentTaskElement.appendChild(renderBlock(block, index.toString()));
        });
    }
}

// Remove block functionality
function removeBlock(blockElement) {
    const index = blockElement.dataset.index;
    const indices = index.split('.');

    if (indices.length === 1) {
        state.currentTask.blocks.splice(indices[0], 1);
    } else {
        // Handle nested blocks in loops
        const parentBlock = state.currentTask.blocks[indices[0]];
        parentBlock.blocks.splice(indices[1], 1);
    }

    updateTaskDisplay();
    // Save immediately after block removal
    saveCurrentTask().then(() => {
        logToConsole('Block removed and saved', 'success');
    }).catch(error => {
        logToConsole('Failed to save after block removal', 'error');
    });
}

// Selection Handling
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;

function startSelection(event) {
    if (!state.pendingBlockConfiguration || event.button !== 0) return; // Only respond to left mouse button

    isSelecting = true;
    const rect = event.target.getBoundingClientRect();
    selectionStartX = event.clientX - rect.left;
    selectionStartY = event.clientY - rect.top;

    const selectionBox = document.getElementById('selectionBox');
    selectionBox.style.left = `${selectionStartX}px`;
    selectionBox.style.top = `${selectionStartY}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.classList.remove('d-none');
}

function updateSelection(event) {
    if (!isSelecting) return;

    const simulator = document.getElementById('simulator');
    const rect = simulator.getBoundingClientRect();

    // Calculate position relative to simulator, clamped to simulator bounds
    let currentX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    let currentY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    const width = currentX - selectionStartX;
    const height = currentY - selectionStartY;

    const selectionBox = document.getElementById('selectionBox');
    selectionBox.style.width = `${Math.abs(width)}px`;
    selectionBox.style.height = `${Math.abs(height)}px`;
    selectionBox.style.left = `${width < 0 ? currentX : selectionStartX}px`;
    selectionBox.style.top = `${height < 0 ? currentY : selectionStartY}px`;
}

function finishSelection(endX, endY) {
    const region = {
        x1: Math.min(selectionStartX, endX),
        y1: Math.min(selectionStartY, endY),
        x2: Math.max(selectionStartX, endX),
        y2: Math.max(selectionStartY, endY)
    };

    const blockIndex = state.pendingBlockConfiguration.dataset.index;
    const indices = blockIndex.split('.');

    // Navigate through nested blocks and update the region
    function updateBlockRegion(blocks, indices, currentDepth = 0) {
        const currentIndex = parseInt(indices[currentDepth]);

        if (currentDepth === indices.length - 1) {
            // We've reached the target block
            blocks[currentIndex].region = region;
            return true;
        }

        // Handle nested blocks in loops and functions
        if (blocks[currentIndex] && blocks[currentIndex].blocks) {
            return updateBlockRegion(blocks[currentIndex].blocks, indices, currentDepth + 1);
        }

        return false;
    }

    // Update the region in the current task's blocks
    if (state.currentTask) {
        const updated = updateBlockRegion(state.currentTask.blocks, indices);
        if (updated) {
            state.pendingBlockConfiguration = null;
            showSelectionBox(region);
            updateTaskDisplay();

            // Save immediately after region update
            saveCurrentTask().then(() => {
                logToConsole('Region set and saved', 'success');
            }).catch(error => {
                logToConsole('Failed to save region', 'error');
                console.error('Save error:', error);
            });
        }
    }
}


// Save blocks functionality
async function saveCurrentTask() {
    if (!state.currentTask) return;

    try {
        const response = await fetch(`/api/tasks/${state.currentTask.id}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks: state.currentTask.blocks })
        });

        if (!response.ok) throw new Error('Failed to save blocks');
        logToConsole('Task saved', 'success');
    } catch (error) {
        logToConsole('Failed to save task', 'error');
        console.error('Save task error:', error);
        throw error;
    }
}

// Add these utility functions for block interaction
function setBlockFocus(block, blockDiv) {
    // Remove focus from other blocks
    document.querySelectorAll('.block').forEach(el => {
        if (el !== blockDiv) {
            el.classList.remove('focused');
        }
    });

    // Add focus to current block
    blockDiv.classList.add('focused');
}

// Add delete all tasks functionality
document.getElementById('deleteAllTasksBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete all tasks?')) {
        return;
    }

    try {
        const response = await fetch('/api/tasks/all', {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete all tasks');

        // Clear tasks from state
        state.tasks = [];
        state.currentTask = null;
        updateTaskList();
        updateTaskDisplay();

        logToConsole('All tasks deleted successfully', 'success');

        // Create a new task since all are deleted
        await createNewTask();
    } catch (error) {
        logToConsole('Error deleting all tasks', 'error');
    }
});

// Block Management
function startTapRegionSelection(blockElement) {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    // Reset selection state
    isSelecting = false;
    selectionStartX = 0;
    selectionStartY = 0;

    // Clear any existing selection box
    const selectionBox = document.getElementById('selectionBox');
    selectionBox.classList.add('d-none');
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';

    state.pendingBlockConfiguration = blockElement;
    logToConsole('Select tap region on the simulator', 'info');
}

function addTapBlock(parentLoopIndex = null, region = null) {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'tap',
        description: 'Click to set region',
        region: region
    };

    if (parentLoopIndex !== null) {
        // Add to loop block
        state.currentTask.blocks[parentLoopIndex].blocks.push(block);
    } else {
        // Add to root level
        state.currentTask.blocks.push(block);
    }

    updateTaskDisplay();
    logToConsole('Tap block added. Click "Set Region" to configure it.', 'success');

    // Auto-enable drawing mode for the new block
    setTimeout(() => {
        const lastBlockDiv = document.querySelector('.tap-block:last-child');
        if (lastBlockDiv) {
            startTapRegionSelection(lastBlockDiv);
            if (region) {
                showSelectionBox(region);
            }
        }
    }, 100);
}

function addLoopBlock(iterations = 1, blocks = []) {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'loop',
        iterations: iterations,
        blocks: blocks
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Loop block added', 'success');
}

function addConditionalBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'conditional',
        data: {
            referenceImage: null,
            threshold: 90,
            thenBlocks: [],
            elseBlocks: []
        }
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Conditional block added', 'success');
}

// Additional functions and logic can be added here as needed