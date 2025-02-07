// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// Initialize state
window.state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null,
    focusedBlock: null  // Track currently focused block
};

// Selection state
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;

// Functions state
let functions = [];

// State management
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const selectionBox = document.getElementById('selectionBox');
    const simulator = document.getElementById('simulator');
    const taskTitle = document.getElementById('taskTitle');

    // Set up event listeners
    document.getElementById('executeTaskBtn').addEventListener('click', executeTask);
    document.getElementById('addTapBtn').addEventListener('click', () => addTapBlock());
    document.getElementById('addLoopBtn').addEventListener('click', () => addLoopBlock());
    document.getElementById('newTaskBtn').addEventListener('click', async () => { await createNewTask(); }); // Updated event listener
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
    simulator.addEventListener('mouseup', stopSelection);
    simulator.addEventListener('mouseleave', () => {
        if (isSelecting) {
            const rect = simulator.getBoundingClientRect();
            const lastKnownX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
            const lastKnownY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
            finishSelection(lastKnownX, lastKnownY);
        }
    });

    // Setup video sharing
    setupVideoSharing();

    // Load functions and tasks
    loadFunctions();
    loadTasks().then(() => {
        console.log('Initial state setup complete:', window.state);
    });

    // Initialize function modal
    const functionModal = document.getElementById('functionModal');
    if (functionModal) {
        new bootstrap.Modal(functionModal);
    }

    // Add save function button handler
    const saveFunctionBtn = document.getElementById('saveFunctionBtn');
    if (saveFunctionBtn) {
        saveFunctionBtn.addEventListener('click', saveFunction);
    }
});

// Make functions available globally
window.processBlocks = function(blocks) {
    console.log('Processing blocks in simulator:', blocks);
    if (!window.state.currentTask) {
        console.error('No active task available');
        return false;
    }

    try {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                addLoopBlock(block.iterations, block.blocks);
            } else if (block.type === 'tap') {
                addTapBlock(null, block.region);
            }
        });
        updateTaskDisplay();
        scheduleAutosave();
        return true;
    } catch (error) {
        console.error('Error processing blocks:', error);
        return false;
    }
};

// Task Management
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to load tasks');

        state.tasks = await response.json();
        updateTaskList();

        if (state.tasks.length > 0) {
            // Load the most recently updated task
            const mostRecentTask = state.tasks.reduce((latest, current) => {
                const latestDate = new Date(latest.updated_at);
                const currentDate = new Date(current.updated_at);
                return currentDate > latestDate ? current : latest;
            }, state.tasks[0]);

            await loadTask(mostRecentTask.id);
        } else {
            // Only create a new task if there are no existing tasks
            await createNewTask();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        logToConsole('Error loading tasks', 'error');
    }
}

async function createNewTask() {
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `Task ${state.tasks.length + 1}`
            })
        });

        if (!response.ok) throw new Error('Failed to create task');

        const task = await response.json();
        state.tasks.push(task);
        updateTaskList();
        await loadTask(task.id);

        logToConsole('New task created', 'success');
    } catch (error) {
        logToConsole('Error creating task', 'error');
    }
}

async function loadTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/blocks`);
        if (!response.ok) throw new Error('Failed to load task blocks');

        const blocks = await response.json();
        state.currentTask = {
            id: taskId,
            blocks: blocks
        };

        updateTaskDisplay();
        updateTaskList();
        logToConsole(`Loaded task ${taskId}`, 'success');
    } catch (error) {
        logToConsole('Error loading task blocks', 'error');
    }
}

// UI Updates
function updateTaskList() {
    const taskList = document.getElementById('taskList');
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

    // Add click handlers for task selection
    taskList.querySelectorAll('.task-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.btn')) {
                const taskId = parseInt(item.dataset.taskId);
                loadTask(taskId);
            }
        });
    });
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
    scheduleAutosave();
}


// Selection Handling (Updated from edited snippet)
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

    const selectionBox = document.getElementById('selectionBox');
    const rect = event.target.getBoundingClientRect();

    // Calculate position relative to simulator
    let currentX = event.clientX - rect.left;
    let currentY = event.clientY - rect.top;

    // Clamp coordinates to simulator bounds
    currentX = Math.min(Math.max(currentX, 0), rect.width);
    currentY = Math.min(Math.max(currentY, 0), rect.height);

    const width = currentX - selectionStartX;
    const height = currentY - selectionStartY;

    selectionBox.style.width = `${Math.abs(width)}px`;
    selectionBox.style.height = `${Math.abs(height)}px`;
    selectionBox.style.left = `${width < 0 ? currentX : selectionStartX}px`;
    selectionBox.style.top = `${height < 0 ? currentY : selectionStartY}px`;
}

function stopSelection(event) {
    if (!isSelecting) return;

    const rect = event.target.getBoundingClientRect();
    const endX = Math.min(Math.max(event.clientX - rect.left, 0), DEVICE_WIDTH);
    const endY = Math.min(Math.max(event.clientY - rect.top, 0), DEVICE_HEIGHT);

    finishSelection(endX, endY);
}

function finishSelection(endX, endY) {
    const region = {
        x1: Math.min(selectionStartX, endX),
        y1: Math.min(selectionStartY, endY),
        x2: Math.max(selectionStartX, endX),
        y2: Math.max(selectionStartY, endY)
    };

    // Find the block to update based on the configuration index
    const blockIndex = state.pendingBlockConfiguration.dataset.index;
    const indices = blockIndex.split('.');
    let targetBlock;
    let currentBlocks = state.currentTask.blocks;

    // Navigate through nested blocks
    for (let i = 0; i < indices.length; i++) {
        const index = parseInt(indices[i]);
        if (i === indices.length - 1) {
            targetBlock = currentBlocks[index];
        } else {
            currentBlocks = currentBlocks[index].blocks;
        }
    }

    if (targetBlock) {
        targetBlock.region = region;
        state.pendingBlockConfiguration = null;
        isSelecting = false;

        // Show selection box for the newly set region
        showSelectionBox(region);
        updateTaskDisplay();
        scheduleAutosave();
        logToConsole('Region updated', 'success');
    }
}

// Add these utility functions for block interaction
function setBlockFocus(block, blockDiv) {
    // Remove focus from other blocks
    document.querySelectorAll('.block').forEach(el => {
        el.classList.remove('focused');
    });

    // Add focus to current block
    blockDiv.classList.add('focused');

    // Update focused block state
    window.state.focusedBlock = block;

    // Show region if it exists
    if (block.region) {
        showSelectionBox(block.region);
    } else {
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.classList.add('d-none');
    }
}

// Enhanced render block function with better iteration controls
function renderBlock(block, index) {
    const blockDiv = document.createElement('div');
    blockDiv.className = `block ${block.type}-block`;
    blockDiv.dataset.index = index;

    if (block.type === 'function') {
        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">${block.name}</h6>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-light edit-function-btn">Edit</button>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <small class="text-muted">${block.description || ''}</small>
            <div class="nested-blocks mt-2"></div>
        `;

        const editBtn = blockDiv.querySelector('.edit-function-btn');
        editBtn.addEventListener('click', () => {
            // Implementation for editing function
        });

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        removeBtn.addEventListener('click', () => removeBlock(blockDiv));

        const nestedContainer = blockDiv.querySelector('.nested-blocks');
        if (block.blocks) {
            block.blocks.forEach((nestedBlock, nestedIndex) => {
                nestedContainer.appendChild(renderBlock(nestedBlock, `${index}.${nestedIndex}`));
            });
        }
    } else if (block.type === 'tap') {
        const regionText = block.region ?
            `(${Math.round(block.region.x1)},${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)},${Math.round(block.region.y2)})` :
            'No region set';

        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Tap Block</h6>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary select-region-btn">
                        ${block.region ? 'Change Region' : 'Set Region'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <small class="text-muted">Region: ${regionText}</small>
        `;

        blockDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.btn')) {
                setBlockFocus(block, blockDiv);
            }
        });

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeBlock(blockDiv));
        }

        blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
            enableDrawingMode(block, blockDiv);
        });
    } else if (block.type === 'loop') {
        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Loop Block</h6>
                <div class="d-flex align-items-center">
                    <div class="input-group input-group-sm" style="width: 100px;">
                        <button class="btn btn-outline-secondary decrease-iterations" type="button">-</button>
                        <input type="number" class="form-control form-control-sm iterations-input text-center"
                            value="${block.iterations}" min="1" style="width: 60px">
                        <button class="btn btn-outline-secondary increase-iterations" type="button">+</button>
                    </div>
                    <span class="ms-2 me-2">times</span>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <div class="nested-blocks mt-2"></div>
        `;

        const iterationsInput = blockDiv.querySelector('.iterations-input');
        const decreaseBtn = blockDiv.querySelector('.decrease-iterations');
        const increaseBtn = blockDiv.querySelector('.increase-iterations');

        // Add event listeners for iteration controls
        decreaseBtn.addEventListener('click', () => {
            const currentValue = parseInt(iterationsInput.value) || 1;
            if (currentValue > 1) {
                iterationsInput.value = currentValue - 1;
                block.iterations = currentValue - 1;
                scheduleAutosave();
            }
        });

        increaseBtn.addEventListener('click', () => {
            const currentValue = parseInt(iterationsInput.value) || 1;
            iterationsInput.value = currentValue + 1;
            block.iterations = currentValue + 1;
            scheduleAutosave();
        });

        iterationsInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 1;
            if (value < 1) {
                e.target.value = 1;
                block.iterations = 1;
            } else {
                block.iterations = value;
            }
            scheduleAutosave();
        });

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeBlock(blockDiv));
        }

        const nestedContainer = blockDiv.querySelector('.nested-blocks');
        block.blocks.forEach((nestedBlock, nestedIndex) => {
            nestedContainer.appendChild(renderBlock(nestedBlock, `${index}.${nestedIndex}`));
        });
    }

    return blockDiv;
}

function enableDrawingMode(block, blockDiv) {
    startTapRegionSelection(blockDiv);
    if (block.region) {
        showSelectionBox(block.region);
    }
}

// Make the simulator's functions available to chatbot.js
window.setBlockFocus = setBlockFocus;
window.showSelectionBox = showSelectionBox;
window.enableDrawingMode = enableDrawingMode;

// Task Execution
function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks || !state.currentTask.blocks.length) {
        logToConsole('No blocks to execute', 'error');
        return;
    }

    logToConsole('Starting task execution', 'info');
    let delay = 0;
    const delayIncrement = 800; // Increased delay between actions for better visibility

    function executeBlocks(blocks) {
        blocks.forEach(block => {
            if (block.type === 'function') {
                // Find the function definition
                const func = functions.find(f => f.name === block.name);
                if (func && func.blocks) {
                    // Execute the function's blocks
                    executeBlocks(func.blocks);
                } else {
                    logToConsole(`Function "${block.name}" not found`, 'error');
                }
            } else if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += delayIncrement;
                setTimeout(() => {
                    showTapFeedback(block.region);
                    logToConsole(`Executed tap at region (${Math.round(block.region.x1)},${Math.round(block.region.y1)})`, 'success');
                }, delay);
            }
        });
    }

    executeBlocks(state.currentTask.blocks);

    setTimeout(() => {
        logToConsole('Task execution completed', 'success');
    }, delay + delayIncrement);
}

// Utilities
function showTapFeedback(region) {
    const centerX = (region.x1 + region.x2) / 2;
    const centerY = (region.y1 + region.y2) / 2;

    const feedback = document.createElement('div');
    feedback.className = 'tap-feedback';
    feedback.style.left = `${centerX}px`;
    feedback.style.top = `${centerY}px`;

    document.getElementById('simulator').appendChild(feedback);

    // Remove the feedback element after animation completes
    feedback.addEventListener('animationend', () => feedback.remove());
}

function setupVideoSharing() {
    const video = document.getElementById('bgVideo');
    document.getElementById('setVideoSource').addEventListener('click', async () => {
        try {
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                },
                audio: false
            });
            video.srcObject = stream;
            logToConsole('Screen sharing started', 'success');
        } catch (error) {
            logToConsole('Screen sharing error: ' + error.message, 'error');
        }
    });
}

function logToConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageEl);
    console.scrollTop = console.scrollHeight;
}

function scheduleAutosave() {
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    state.autoSaveTimeout = setTimeout(async () => {
        if (state.currentTask) {
            try {
                const response = await fetch(`/api/tasks/${state.currentTask.id}/blocks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blocks: state.currentTask.blocks
                    })
                });

                if (!response.ok) throw new Error('Failed to save blocks');
                logToConsole('Task autosaved', 'success');
            } catch (error) {
                logToConsole('Failed to autosave task', 'error');
            }
        }
    }, 2000);
}

async function deleteTask(taskId) {
    if (!taskId) {
        logToConsole('No task selected to delete', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete task');

        // Remove task from state
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        updateTaskList();

        // If the deleted task was the current task, clear it
        if (state.currentTask && state.currentTask.id === taskId) {
            state.currentTask = null;
            updateTaskDisplay();
        }

        logToConsole('Task deleted successfully', 'success');

        // Load another task if available
        if (state.tasks.length > 0) {
            await loadTask(state.tasks[0].id);
        }
    } catch (error) {
        logToConsole('Error deleting task', 'error');
    }
}

// Add delete button event listener 
document.getElementById('deleteTaskBtn').addEventListener('click', () => {
    const taskId = document.querySelector('.task-list-item.active').dataset.taskId;
    deleteTask(taskId);
});

// Add new function to show selection box for existing region
function showSelectionBox(region) {
    const selectionBox = document.getElementById('selectionBox');
    if (!selectionBox) return;

    selectionBox.style.left = `${region.x1}px`;
    selectionBox.style.top = `${region.y1}px`;
    selectionBox.style.width = `${region.x2 - region.x1}px`;
    selectionBox.style.height = `${region.y2 - region.y1}px`;
    selectionBox.classList.remove('d-none');
}

// Add these new functions for function management
async function loadFunctions() {
    try {
        const response = await fetch('/api/functions');
        if (!response.ok) throw new Error('Failed to load functions');

        functions = await response.json();
        updateFunctionsList();
    } catch (error) {
        logToConsole('Error loading functions', 'error');
    }
}

function updateFunctionsList() {
    const functionsList = document.getElementById('functionsList');
    functionsList.innerHTML = functions.map(func => `
        <li>
            <a class="dropdown-item" href="#" onclick="addFunctionBlock(${func.id})">${func.name}</a>
        </li>
    `).join('') || '<li><span class="dropdown-item">No functions available</span></li>';
}

// Function creation handling
function addBlockToFunction(type, parentElement = null) {
    const container = parentElement ? 
        parentElement.querySelector('.nested-blocks') : 
        document.getElementById('functionBlocks');

    const block = {
        type: type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Block`,
        // For function creation, we don't set region or iterations initially
        data: {} // Empty data object for now
    };

    const blockElement = document.createElement('div');
    blockElement.className = `block ${type}-block`;

    if (type === 'loop') {
        blockElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Loop Block</h6>
                <div class="input-group" style="width: auto;">
                    <input type="number" class="form-control form-control-sm iterations-input" 
                           value="1" min="1" style="width: 70px">
                    <span class="input-group-text">times</span>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <div class="nested-blocks mt-2"></div>
            <div class="btn-group mt-2 w-100">
                <button class="btn btn-sm btn-outline-primary add-tap-to-loop-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-to-loop-btn">Add Loop</button>
            </div>
        `;

        // Add event listeners for nested block buttons
        blockElement.querySelector('.add-tap-to-loop-btn').addEventListener('click', () => {
            addBlockToFunction('tap', blockElement);
        });
        blockElement.querySelector('.add-loop-to-loop-btn').addEventListener('click', () => {
            addBlockToFunction('loop', blockElement);
        });

        // Add event listener for iterations input
        const iterationsInput = blockElement.querySelector('.iterations-input');
        iterationsInput.addEventListener('change', (e) => {
            block.data.iterations = parseInt(e.target.value) || 1;
        });
    } else {
        blockElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Tap Block</h6>
                <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
            </div>
        `;
    }

    blockElement.querySelector('.remove-block-btn').addEventListener('click', () => {
        blockElement.remove();
    });

    container.appendChild(blockElement);
}

async function saveFunction() {
    const nameInput = document.getElementById('functionName');
    const descriptionInput = document.getElementById('functionDescription');
    const blocksContainer = document.getElementById('functionBlocks');

    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!name) {
        logToConsole('Function name is required', 'error');
        return;
    }

    // Collect blocks from the container with nested structure
    function collectBlocks(container) {
        return Array.from(container.children).map(blockElement => {
            const type = blockElement.classList.contains('tap-block') ? 'tap' : 'loop';
            const block = {
                type,
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} Block`
            };

            if (type === 'loop') {
                const iterationsInput = blockElement.querySelector('.iterations-input');
                block.iterations = parseInt(iterationsInput.value) || 1;

                const nestedContainer = blockElement.querySelector('.nested-blocks');
                if (nestedContainer) {
                    block.blocks = collectBlocks(nestedContainer);
                }
            }
            return block;
        });
    }

    const blocks = collectBlocks(blocksContainer);

    try {
        const response = await fetch('/api/functions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                blocks
            })
        });

        if (!response.ok) throw new Error('Failed to save function');

        const savedFunction = await response.json();
        functions.push(savedFunction);
        updateFunctionsList();

        // Close modal and reset form
        const modal = document.getElementById('functionModal');
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            bsModal.hide();
        } else {
            const newModal = new bootstrap.Modal(modal);
            newModal.hide();
        }

        nameInput.value = '';
        descriptionInput.value = '';
        blocksContainer.innerHTML = '';

        logToConsole('Function saved successfully', 'success');
    } catch (error) {
        logToConsole('Error saving function: ' + error.message, 'error');
    }
}}

async function addFunctionBlock(functionId) {
    const func = functions.find(f => f.id === functionId);
    if (!func) {
        logToConsole('Function not found', 'error');
        return;
    }

    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'function',
        name: func.name,
        description: func.description || '',
        blocks: func.blocks // Store the function's blocks for reference
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole(`Added function: ${func.name}`, 'success');
}