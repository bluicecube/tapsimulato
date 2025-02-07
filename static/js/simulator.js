// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// Initialize state
window.state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null
};

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
    document.getElementById('newTaskBtn').addEventListener('click', createNewTask);

    // Selection events
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Setup video sharing
    setupVideoSharing();

    // Create initial task and load tasks
    createNewTask().then(() => {
        loadTasks();
        console.log('Initial state setup complete:', window.state);
    });
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
            await loadTask(state.tasks[0].id);
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
                        onclick="deleteTask(${task.id})" title="Delete task">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Add click handlers for task selection
    taskList.querySelectorAll('.task-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-group')) {
                const taskId = parseInt(item.dataset.taskId);
                loadTask(taskId);
            }
        });
    });
}

// Block Management
function startTapRegionSelection(blockElement) {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }
    logToConsole('Select tap region on the simulator', 'info');
    isSelecting = true;
    state.pendingBlockConfiguration = blockElement;
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

    function renderBlock(block, index) {
        const blockDiv = document.createElement('div');
        blockDiv.className = `block ${block.type}-block`;
        blockDiv.dataset.index = index;

        if (block.type === 'tap') {
            const regionText = block.region ?
                `(${Math.round(block.region.x1)},${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)},${Math.round(block.region.y2)})` :
                'No region set';

            blockDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <input type="text" class="form-control form-control-sm block-name-input" 
                           value="${block.name || 'Tap Block'}" style="width: 120px">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary select-region-btn">
                            ${block.region ? 'Change Region' : 'Set Region'}
                        </button>
                        <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                    </div>
                </div>
                <small class="text-muted">Region: ${regionText}</small>
            `;

            // Add click handler to show region and enable drawing mode
            blockDiv.addEventListener('click', (e) => {
                if (!e.target.closest('.btn')) {
                    setBlockFocus(block, blockDiv);
                }
            });

            const nameInput = blockDiv.querySelector('.block-name-input');
            nameInput.addEventListener('change', () => {
                block.name = nameInput.value;
                scheduleAutosave();
            });

            blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
                enableDrawingMode(block, blockDiv);
            });
        } else if (block.type === 'loop') {
            blockDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <input type="text" class="form-control form-control-sm block-name-input" 
                           value="${block.name || 'Loop Block'}" style="width: 120px">
                    <div class="d-flex align-items-center">
                        <input type="number" class="form-control form-control-sm iterations-input"
                            value="${block.iterations}" min="1" style="width: 70px">
                        <span class="ms-2">times</span>
                        <div class="btn-group ms-2">
                            <button class="btn btn-sm btn-outline-primary add-nested-tap-btn">Add Tap</button>
                            <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                        </div>
                    </div>
                </div>
                <div class="nested-blocks mt-2"></div>
            `;

            const nameInput = blockDiv.querySelector('.block-name-input');
            nameInput.addEventListener('change', () => {
                block.name = nameInput.value;
                scheduleAutosave();
            });

            const iterationsInput = blockDiv.querySelector('.iterations-input');
            iterationsInput.addEventListener('change', (e) => {
                block.iterations = parseInt(e.target.value) || 1;
                scheduleAutosave();
            });

            const addNestedTapBtn = blockDiv.querySelector('.add-nested-tap-btn');
            addNestedTapBtn.addEventListener('click', () => {
                const loopIndex = parseInt(index);
                addTapBlock(loopIndex);
            });

            const nestedContainer = blockDiv.querySelector('.nested-blocks');
            block.blocks.forEach((nestedBlock, nestedIndex) => {
                nestedContainer.appendChild(renderBlock(nestedBlock, `${index}.${nestedIndex}`));
            });
        }

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeBlock(blockDiv));
        }

        return blockDiv;
    }

    if (state.currentTask && state.currentTask.blocks) {
        state.currentTask.blocks.forEach((block, index) => {
            currentTaskElement.appendChild(renderBlock(block, index.toString()));
        });
    }
}

// Selection Handling
function startSelection(event) {
    if (!isSelecting) return;

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
    if (selectionBox.classList.contains('d-none')) return;

    const rect = event.target.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const width = currentX - selectionStartX;
    const height = currentY - selectionStartY;

    selectionBox.style.width = `${Math.abs(width)}px`;
    selectionBox.style.height = `${Math.abs(height)}px`;
    selectionBox.style.left = `${width < 0 ? currentX : selectionStartX}px`;
    selectionBox.style.top = `${height < 0 ? currentY : selectionStartY}px`;
}

function stopSelection(event) {
    if (!isSelecting || !state.pendingBlockConfiguration) return;

    const rect = event.target.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    const region = {
        x1: Math.min(selectionStartX, endX),
        y1: Math.min(selectionStartY, endY),
        x2: Math.max(selectionStartX, endX),
        y2: Math.max(selectionStartY, endY)
    };

    // Update the block with the selected region
    const blockIndex = state.pendingBlockConfiguration.dataset.index;
    const indices = blockIndex.split('.');
    let targetBlock = state.currentTask.blocks[indices[0]];

    if (indices.length > 1) {
        // Handle nested blocks
        targetBlock = targetBlock.blocks[indices[1]];
    }

    targetBlock.region = region;
    targetBlock.description = `Tap at (${Math.round((region.x1 + region.x2)/2)}, ${Math.round((region.y1 + region.y2)/2)})`;

    const selectionBox = document.getElementById('selectionBox');
    selectionBox.classList.add('d-none');
    isSelecting = false;
    state.pendingBlockConfiguration = null;

    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Region set for tap block', 'success');
}

// Task Execution
function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks || !state.currentTask.blocks.length) {
        logToConsole('No blocks to execute', 'error');
        return;
    }

    logToConsole('Starting task execution', 'info');
    let delay = 0;

    function executeBlocks(blocks) {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += 500;
                setTimeout(() => {
                    showTapFeedback(block.region);
                    logToConsole(`Executed ${block.description}`, 'success');
                }, delay);
            }
        });
    }

    executeBlocks(state.currentTask.blocks);

    setTimeout(() => {
        logToConsole('Task execution completed', 'success');
    }, delay + 500);
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
    setTimeout(() => feedback.remove(), 500);
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

let isSelecting = false;
let selectionStartX, selectionStartY;

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

// Add these utility functions for block interaction
function setBlockFocus(block, blockDiv) {
    if (block.region) {
        showSelectionBox(block.region);
    }
    enableDrawingMode(block, blockDiv);
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