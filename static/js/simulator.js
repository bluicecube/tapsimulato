// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// Initial state setup
window.state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null,
    focusedBlock: null,
    lastTaskId: localStorage.getItem('lastTaskId'),
    currentFrame: null
};

// Functions state
let functions = [];

// Add serialization functions
function serializeBlock(block) {
    const serializedBlock = {
        type: block.type,
        name: block.name || null,
        data: {},
        order: block.order || 0
    };

    // Save type-specific data
    switch (block.type) {
        case 'tap':
            if (block.region) {
                serializedBlock.data.region = block.region;
            }
            break;
        case 'loop':
            serializedBlock.data.iterations = block.iterations || 1;
            if (block.blocks && block.blocks.length > 0) {
                serializedBlock.blocks = block.blocks.map(serializeBlock);
            }
            break;
        case 'function':
            serializedBlock.data.functionId = block.functionId;
            serializedBlock.data.description = block.description;
            if (block.blocks && block.blocks.length > 0) {
                serializedBlock.blocks = block.blocks.map(serializeBlock);
            }
            break;
        case 'conditional':
            serializedBlock.data.threshold = block.data.threshold;
            if (block.data.referenceImage) {
                serializedBlock.data.referenceImage = block.data.referenceImage;
            }
            if (block.data.thenBlocks && block.data.thenBlocks.length > 0) {
                serializedBlock.data.thenBlocks = block.data.thenBlocks.map(serializeBlock);
            }
            if (block.data.elseBlocks && block.data.elseBlocks.length > 0) {
                serializedBlock.data.elseBlocks = block.data.elseBlocks.map(serializeBlock);
            }
            break;
        case 'url':
            serializedBlock.data.url = block.url;
            break;

    }

    return serializedBlock;
}

function deserializeBlock(block) {
    const deserializedBlock = {
        ...block,
        type: block.type,
    };

    // Restore type-specific data
    switch (block.type) {
        case 'tap':
            if (block.data && block.data.region) {
                deserializedBlock.region = block.data.region;
            }
            break;
        case 'loop':
            deserializedBlock.iterations = block.data?.iterations || 1;
            if (block.blocks && block.blocks.length > 0) {
                deserializedBlock.blocks = block.blocks.map(deserializeBlock);
            }
            break;
        case 'function':
            deserializedBlock.functionId = block.data?.functionId;
            deserializedBlock.description = block.data?.description;
            if (block.blocks && block.blocks.length > 0) {
                deserializedBlock.blocks = block.blocks.map(deserializeBlock);
            }
            break;
        case 'conditional':
            deserializedBlock.data = {
                threshold: block.data.threshold,
                referenceImage: block.data.referenceImage,
                thenBlocks: block.data.thenBlocks ? block.data.thenBlocks.map(deserializeBlock) : [],
                elseBlocks: block.data.elseBlocks ? block.data.elseBlocks.map(deserializeBlock) : []
            };
            break;
        case 'url':
            deserializedBlock.url = block.data.url;
            break;
    }

    return deserializedBlock;
}

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

    // Remove the mouseleave handler that was forcing selection completion
    simulator.removeEventListener('mouseleave', () => {});


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
            } else if (block.type === 'url') {
                addUrlBlock(block.url);
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
            let taskToLoad;

            // Try to load last opened task
            if (state.lastTaskId) {
                taskToLoad = state.tasks.find(t => t.id === parseInt(state.lastTaskId));
            }

            // If no last task or it doesn't exist, load most recent
            if (!taskToLoad) {
                taskToLoad = state.tasks[0];
            }

            await loadTask(taskToLoad.id);
        } else {
            // Only create a new task if there are no existing tasks
            await createNewTask();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        logToConsole('Error loading tasks', 'error');

        // Create a new task as fallback
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

// Add autosave before loading new task
async function loadTask(taskId) {
    try {
        // Save current task before loading new one
        if (state.currentTask) {
            await saveCurrentTask();
        }

        const response = await fetch(`/api/tasks/${taskId}/blocks`);
        if (!response.ok) throw new Error('Failed to load task blocks');

        const blocks = await response.json();
        console.log('Loaded blocks:', blocks);

        state.currentTask = {
            id: taskId,
            blocks: blocks.map(deserializeBlock)
        };

        // Save last opened task ID
        state.lastTaskId = taskId;
        localStorage.setItem('lastTaskId', taskId);

        const taskTitle = document.getElementById('taskTitle');
        const currentTask = state.tasks.find(t => t.id === taskId);
        if (currentTask && taskTitle) {
            taskTitle.value = currentTask.name || '';
        }

        updateTaskDisplay();
        updateTaskList();
        logToConsole(`Loaded task ${taskId}`, 'success');
    } catch (error) {
        logToConsole('Error loading task blocks', 'error');
        console.error('Load task error:', error);
        throw error;
    }
}

// UI Updates
function updateTaskList() {
    const taskList = document.getElementById('taskList');
    if (!taskList) {
        console.warn('Task list element not found');
        return;
    }

    taskList.innerHTML = state.tasks.map(task => `
        <div class="task-list-item ${state.currentTask && state.currentTask.id === task.id ? 'active' : ''}" 
             data-task-id="${task.id}">
            <span>${task.name}</span>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-danger delete-task-btn" 
                        data-task-id="${task.id}">×</button>
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

    // Add delete handlers
    taskList.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = parseInt(btn.dataset.taskId);
            deleteTask(taskId);
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
    let targetBlock;
    let currentBlocks = state.currentTask.blocks;

    // Store the collapse state before updating
    const wasCollapsed = state.pendingBlockConfiguration.closest('.block.collapsed');

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

        // Show selection box for the newly set region
        showSelectionBox(region);
        updateTaskDisplay();

        // Restore collapse state after update if it was collapsed
        if (wasCollapsed) {
            const newBlockElement = document.querySelector(`[data-index="${blockIndex}"]`);
            if (newBlockElement) {
                newBlockElement.classList.add('collapsed');
                const nestedBlocks = newBlockElement.querySelector('.nested-blocks');
                if (nestedBlocks) {
                    nestedBlocks.classList.add('collapsed');
                }
            }
        }

        // Save immediately after region update
        saveCurrentTask().then(() => {
            logToConsole('Region updated and saved', 'success');
        }).catch(error => {
            logToConsole('Failed to save region', 'error');
        });
    }
}

// Save blocks functionality
async function saveCurrentTask() {
    if (!state.currentTask) return;

    try {
        const blocks = state.currentTask.blocks.map(serializeBlock);

        const response = await fetch(`/api/tasks/${state.currentTask.id}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks })
        });

        if (!response.ok) throw new Error('Failed to save blocks');
        logToConsole('Task saved', 'success');
    } catch (error) {
        logToConsole('Failed to save task', 'error');
        console.error('Save task error:', error);
        throw error;
    }
}

// Enhanced scheduleAutosave to provide immediate feedback
function scheduleAutosave() {
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    state.autoSaveTimeout = setTimeout(async () => {
        if (state.currentTask) {
            try {
                await saveCurrentTask();
            } catch (error) {
                console.error('Autosave failed:', error);
            }
        }
    }, 1000); // Reduced timeout for more responsive saving
}

// Add these utility functions for block interaction
function setBlockFocus(block, blockDiv) {
    // Remove focus from other blocks
    document.querySelectorAll('.block').forEach(el => {
        if (el !== blockDiv) {
            el.classList.remove('focused');
            // Hide selection box if switching focus
            if (state.focusedBlock && state.focusedBlock.type === 'tap') {
                const selectionBox = document.getElementById('selectionBox');
                selectionBox.classList.add('d-none');
            }
        }
    });

    // Add focus to current block
    blockDiv.classList.add('focused');

    // Update focused block state
    window.state.focusedBlock = block;

    // Show region if it exists
    if (block.type === 'tap') {
        if (block.region) {
            showSelectionBox(block.region);
        } else {
            // If no region is set, hide the selection box
            const selectionBox = document.getElementById('selectionBox');
            selectionBox.classList.add('d-none');
        }
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
                <div class="header-clickable d-flex align-items-center" style="flex: 1">
                    <h6 class="mb-0">${block.name}</h6>
                    <span class="collapse-indicator">▼</span>
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <small class="text-muted">${block.description || ''}</small>
            <div class="nested-blocks mt-2"></div>
            <div class="btn-group mt-2 w-100">
                <button class="btn btn-sm btn-outline-primary add-tap-to-function-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-to-function-btn">Add Loop</button>
            </div>
        `;

        // Add click handler for collapse
        const header = blockDiv.querySelector('.header-clickable');
        const nestedBlocks = blockDiv.querySelector('.nested-blocks');

        header.addEventListener('click', (e) => {
            if (!e.target.closest('.btn')) {
                blockDiv.classList.toggle('collapsed');
                nestedBlocks.classList.toggle('collapsed');
            }
        });

        // Add event listeners
        const addTapBtn = blockDiv.querySelector('.add-tap-to-function-btn');
        const addLoopBtn = blockDiv.querySelector('.add-loop-to-function-btn');
        const removeBtn = blockDiv.querySelector('.remove-block-btn');

        if (addTapBtn) {
            addTapBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addBlockToFunction('tap', blockDiv);
            });
        }

        if (addLoopBtn) {
            addLoopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addBlockToFunction('loop', blockDiv);
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeBlock(blockDiv);
            });
        }

        // Render nested blocks
        const nestedContainer = blockDiv.querySelector('.nested-blocks');
        if (block.blocks) {
            block.blocks.forEach((nestedBlock, nestedIndex) => {
                nestedContainer.appendChild(renderBlock(nestedBlock, `${index}.${nestedIndex}`));
            });
        }
    } else if (block.type === 'tap') {
        return renderTapBlock(block, blockDiv, index);
    } else if (block.type === 'loop') {
        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="header-clickable d-flex align-items-center" style="flex: 1">
                    <h6 class="mb-0">Loop Block</h6>
                    <span class="collapse-indicator">▼</span>
                </div>
                <div class="iteration-controls">
                    <div class="input-group input-group-sm">
                        <button class="btn btn-outline-secondary decrease-iterations" type="button">-</button>
                        <input type="number" class="form-control iterations-input"
                            value="${block.iterations}" min="1">
                        <button class="btn btn-outline-secondary increase-iterations" type="button">+</button>
                    </div>
                    <span class="ms-2">times</span>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn ms-2">×</button>
                </div>
            </div>
            <div class="nested-blocks mt-2"></div>
        `;

        // Add click handler for collapse
        const header = blockDiv.querySelector('.header-clickable');
        const nestedBlocks = blockDiv.querySelector('.nested-blocks');

        header.addEventListener('click', (e) => {
            if (!e.target.closest('.btn') && !e.target.closest('.iteration-controls')) {
                blockDiv.classList.toggle('collapsed');
                nestedBlocks.classList.toggle('collapsed');
            }
        });

        // Add event listeners
        const iterationsInput = blockDiv.querySelector('.iterations-input');
        const decreaseBtn = blockDiv.querySelector('.decrease-iterations');
        const increaseBtn = blockDiv.querySelector('.increase-iterations');
        const removeBtn = blockDiv.querySelector('.remove-block-btn');

        if (iterationsInput && decreaseBtn && increaseBtn) {
            decreaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentValue = parseInt(iterationsInput.value) || 1;
                if (currentValue > 1) {
                    iterationsInput.value = currentValue - 1;
                    handleIterationsChange(block, currentValue - 1, iterationsInput);
                }
            });

            increaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentValue = parseInt(iterationsInput.value) || 1;
                iterationsInput.value = currentValue + 1;
                handleIterationsChange(block, currentValue + 1, iterationsInput);
            });

            iterationsInput.addEventListener('change', (e) => {
                e.stopPropagation();
                const value = parseInt(e.target.value) || 1;
                handleIterationsChange(block, value, iterationsInput);
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeBlock(blockDiv);
            });
        }

        // Render nested blocks
        const nestedContainer = blockDiv.querySelector('.nested-blocks');
        if (block.blocks) {
            block.blocks.forEach((nestedBlock, nestedIndex) => {
                nestedContainer.appendChild(renderBlock(nestedBlock, `${index}.${nestedIndex}`));
            });
        }
    } else if (block.type === 'conditional') {
        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Logic Block</h6>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary capture-reference-btn">
                        ${block.data.referenceImage ? 'Update Reference' : 'Capture Reference'}
                    </button>
                    <input type="number" class="form-control form-control-sm threshold-input" 
                           value="${block.data.threshold}" min="0" max="100" style="width: 70px">
                    <span class="ms-2 me-2">% similar</span>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <div class="mt-2">
                <div class="nested-blocks then-blocks">
                    <p class="mb-2">If similar enough:</p>
                    <div class="btn-group w-100 mb-2">
                        <button class="btn btn-sm btn-outline-primary add-then-tap-btn">Add Tap</button>
                        <button class="btn btn-sm btn-outline-success add-then-loop-btn">Add Loop</button>
                    </div>
                </div>
                <div class="nested-blocks else-blocks">
                    <p class="mb-2">If not similar enough:</p>
                    <div class="btn-group w-100 mb-2">
                        <button class="btn btn-sm btn-outline-primary add-else-tap-btn">Add Tap</button>
                        <button class="btn btn-sm btn-outline-success add-else-loop-btn">Add Loop</button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        const captureBtn = blockDiv.querySelector('.capture-reference-btn');
        captureBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const imageData = captureVideoFrame();

            try {
                const response = await fetch(`/api/blocks/${block.id}/reference-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageData })
                });

                if (!response.ok) throw new Error('Failed to save reference image');

                block.data.referenceImage = imageData;
                captureBtn.textContent = 'Update Reference';
                scheduleAutosave();
                logToConsole('Reference image captured', 'success');
            } catch (error) {
                logToConsole('Failed to save reference image', 'error');
            }
        });

        // Add threshold change handler
        const thresholdInput = blockDiv.querySelector('.threshold-input');
        thresholdInput.addEventListener('change', (e) => {
            block.data.threshold = parseInt(e.target.value) || 90;
            scheduleAutosave();
        });

        // Add delete handler
        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeBlock(blockDiv);
            });
        }

        // Add buttons for then/else blocks
        ['then', 'else'].forEach(section => {
            blockDiv.querySelector(`.add-${section}-tap-btn`).addEventListener('click', () => {
                addTapBlock(index, `${section}Blocks`);
            });

            blockDiv.querySelector(`.add-${section}-loop-btn`).addEventListener('click', () => {
                addLoopBlock(index, `${section}Blocks`);
            });
        });

        // Render nested blocks
        if (block.data.thenBlocks) {
            const thenContainer = blockDiv.querySelector('.thenblocks');
            block.data.thenBlocks.forEach((nestedBlock, nestedIndex) => {
                thenContainer.appendChild(renderBlock(`nestedBlock, `${index}.then.${nestedIndex}`));
            });
        }

        if (block.data.elseBlocks) {
            const elseContainer = blockDiv.querySelector('.else-blocks');
            block.data.elseBlocks.forEach((nestedBlock, nestedIndex) => {
                elseContainer.appendChild(renderBlock(nestedBlock, `${index}.else.${nestedIndex}`));
            });
        }
    } else if (block.type === 'url') {
        return renderUrlBlock(block, blockDiv, index);
    }

    return blockDiv;
}

function renderTapBlock(block, blockDiv, index) {
    const updateRegionDisplay = () => {
        const regionText = block.region ?
            `(${Math.round(block.region.x1)},${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)},${Math.round(block.region.y2)})` :
            'No region set';

        blockDiv.querySelector('.region-text').textContent = `Region: ${regionText}`;
    };

    blockDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Tap Block</h6>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary set-region-btn">Set Region</button>
                <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
            </div>
        </div>
        <small class="text-muted region-text">Region: ${block.region ?
            `(${Math.round(block.region.x1)},${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)},${Math.round(block.region.y2)})` :
            'No region set'}</small>
    `;

    // Handle block selection and region definition
    blockDiv.addEventListener('click', (e) => {
        if (!e.target.closest('.btn')) {
            e.stopPropagation();
            setBlockFocus(block, blockDiv);
        }
    });

    // Add dedicated button for region selection
    const setRegionBtn = blockDiv.querySelector('.set-region-btn');
    setRegionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startTapRegionSelection(blockDiv);
        if (block.region) {
            showSelectionBox(block.region);
        }
    });

    const removeBtn = blockDiv.querySelector('.remove-block-btn');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBlock(blockDiv);
    });

    // Update region display when the block's region changes
    if (block.region) {
        showSelectionBox(block.region);
    }
    return blockDiv;
}

function enableDrawingMode(block, blockDiv) {
    // If it's a tap block, start region selection immediately
    if (block.type === 'tap') {
        startTapRegionSelection(blockDiv);
        if (block.region) {
            showSelectionBox(block.region);
        }
    }
}

// Make the simulator's functions available to chatbot.js
window.setBlockFocus = setBlockFocus;
window.showSelectionBox = showSelectionBox;
window.enableDrawingMode = enableDrawingMode;

// Task Execution
async function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks || !state.currentTask.blocks.length) {
        logToConsole('No blocks to execute', 'error');
        return;
    }

    logToConsole('Starting task execution', 'info');
    let delay = 0;
    const delayIncrement = 800;

    async function executeBlocks(blocks) {
        for (const block of blocks) {
            if (block.type === 'function') {
                // Find the function definition
                const func = functions.find(f => f.name === block.name);
                if (func && func.blocks) {
                    // Execute the function's blocks
                    await executeBlocks(func.blocks);
                } else {
                    logToConsole(`Function "${block.name}" not found`, 'error');
                }
            } else if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    await executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += delayIncrement;
                setTimeout(() => {
                    const coords = showTapFeedback(block.region);
                    logToConsole(`Executed tap at coordinates (${Math.round(coords.x)},${Math.round(coords.y)})`, 'success');
                }, delay);
            } else if (block.type === 'conditional') {
                const currentImage = captureVideoFrame();
                try {
                    const response = await fetch(`/api/blocks/${block.id}/compare-image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: currentImage })
                    });

                    if (!response.ok) throw new Error('Failed to compare images');

                    const result = await response.json();
                    const blocksToExecute = result.similarity >= result.threshold ?
                        block.data.thenBlocks : block.data.elseBlocks;

                    logToConsole(`Image similarity: ${result.similarity.toFixed(1)}% (threshold: ${result.threshold}%)`, 'info');
                    await executeBlocks(blocksToExecute);
                } catch (error) {
                    logToConsole('Error executing conditional block: ' + error.message, 'error');
                }
            } else if (block.type === 'url') {
                await executeUrlBlock(block);
            }
        }
    }

    await executeBlocks(state.currentTask.blocks);
    setTimeout(() => {
        logToConsole('Task execution completed', 'success');
    }, delay + delayIncrement);
}

// Utilities
function showTapFeedback(region) {
    // Calculate random coordinates within the region
    const x = Math.floor(Math.random() * (region.x2 - region.x1)) + region.x1;
    const y = Math.floor(Math.random() * (region.y2 - region.y1)) + region.y1;

    const feedback = document.createElement('div');
    feedback.className = 'tap-feedback';
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;

    document.getElementById('simulator').appendChild(feedback);
    feedback.addEventListener('animationend', () => feedback.remove());

    // Return the actual coordinates used for logging
    return { x, y };
}

// Fix the video sharing configuration
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
            logToConsole('Failed to start screen sharing: ' + error.message, 'error');
        }
    });
}

// Modify the logToConsole function to work with the collapsible console
function logToConsole(message, type = 'info') {
    const consoleElement = document.getElementById('liveConsole');

    // Create console header if it doesn't exist
    if (!consoleElement.querySelector('.console-header')) {
        const header = document.createElement('div');
        header.className = 'console-header';
        header.innerHTML = `
            <span>Console Output</span>
            <span class="console-collapse-icon">▼</span>
        `;

        const content = document.createElement('div');
        content.className = 'console-content';

        // Move existing messages to content
        while (consoleElement.firstChild) {
            content.appendChild(consoleElement.firstChild);
        }

        consoleElement.appendChild(header);
        consoleElement.appendChild(content);

        // Add click handler for collapse/expand
        header.addEventListener('click', () => {
            consoleElement.classList.toggle('collapsed');
        });

        // Set initial state to collapsed
        consoleElement.classList.add('collapsed');
    }

    const content = consoleElement.querySelector('.console-content');
    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = message;
    content.appendChild(messageEl);
    content.scrollTop = content.scrollHeight;
}

function scheduleAutosave() {
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    state.autoSaveTimeout = setTimeout(async () => {
        if (state.currentTask) {
            try {
                await saveCurrentTask();
            } catch (error) {
                console.error('Autosave failed:', error);
            }
        }
    }, 1000);
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

function updateTaskList() {
    const taskList = document.getElementById('taskList');
    if (!taskList) {
        console.warn('Task list element not found');
        return;
    }

    taskList.innerHTML = state.tasks.map(task => `
        <div class="task-list-item ${state.currentTask && state.currentTask.id === task.id ? 'active' : ''}" 
             data-task-id="${task.id}">
            <span>${task.name}</span>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-danger delete-task-btn" 
                        data-task-id="${task.id}">×</button>
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

    // Add delete handlers
    taskList.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = parseInt(btn.dataset.taskId);
            deleteTask(taskId);
        });
    });
}

// Save current task function
async function saveCurrentTask() {
    if (!state.currentTask) return;

    try {
        const blocks = state.currentTask.blocks.map(serializeBlock);

        const response = await fetch(`/api/tasks/${state.currentTask.id}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks })
        });

        if (!response.ok) throw new Error('Failed to save blocks');
        logToConsole('Task saved', 'success');
    } catch (error) {
        logToConsole('Failed to save task', 'error');
        console.error('Save task error:', error);
        throw error;
    }
}

// Remove the current dropdown implementation and replace with new version
function updateFunctionsList() {
    const functionsList = document.getElementById('functionsList');
    if (!functionsList) return;

    // Clear existing content
    functionsList.innerHTML = '';

    // Add "Delete All" option if there are functions
    if (functions && functions.length > 0) {
        // Add delete all button
        const deleteAllItem = document.createElement('li');
        deleteAllItem.innerHTML = `
            <div class="dropdown-item">
                <button class="btn btn-danger btn-sm w-100" id="deleteAllFunctionsBtn">
                    Delete All Functions
                </button>
            </div>
        `;
        functionsList.appendChild(deleteAllItem);

        // Add divider
        const divider = document.createElement('li');
        divider.innerHTML = '<hr class="dropdown-divider">';
        functionsList.appendChild(divider);

        // Add each function with its delete button
        functions.forEach(func => {
            const item = document.createElement('li');
            item.innerHTML = `
                <div class="dropdown-item d-flex justify-content-between align-items-center">
                    <span class="function-name" style="cursor: pointer">${func.name}</span>
                    <button class="btn btn-danger btn-sm delete-function-btn ms-2">×</button>
                </div>
            `;

            // Add function to task when name is clicked
            const nameSpan = item.querySelector('.function-name');
            nameSpan.addEventListener('click', () => {
                if (!state.currentTask) {
                    logToConsole('Please create or select a task first', 'error');
                    return;
                }
                addFunctionToTask(func);
            });

            // Delete function when delete button is clicked
            const deleteBtn = item.querySelector('.delete-function-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFunction(func.id);
            });

            functionsList.appendChild(item);
        });
    } else {
        // Show "No functions" message if no functions exist
        const emptyItem = document.createElement('li');
        emptyItem.innerHTML = '<span class="dropdown-item text-muted">No functions available</span>';
        functionsList.appendChild(emptyItem);
    }

    // Add delete all functions event handler
    const deleteAllBtn = document.getElementById('deleteAllFunctionsBtn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', deleteAllFunctions);
    }
}

// Update the functions array and refresh the list
async function loadFunctions() {
    try {
        const response = await fetch('/api/functions');
        if (!response.ok) throw new Error('Failed to load functions');

        functions = await response.json();
        updateFunctionsList();
    } catch (error) {
        console.error('Error loading functions:', error);
        logToConsole('Failed to load functions', 'error');
    }
}

// Make sure to call loadFunctions when the page loads and after any function changes
document.addEventListener('DOMContentLoaded', () => {
    // Add to existing DOMContentLoaded event listener
    loadFunctions();
});

function addBlockToFunction(type, parentElement = null) {
    const container = parentElement ?
        parentElement.querySelector('.nested-blocks') :
        document.getElementById('functionBlocks');

    if (!container) {
        logToConsole('Error: Could not find container for new block', 'error');
        return;
    }

    const block = {
        type: type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Block`
    };

    if (type === 'loop') {
        block.iterations = 1;
        block.blocks = [];
    }

    const blockElement = document.createElement('div');
    blockElement.className = `block ${type}-block`;

    if (type === 'loop') {
        blockElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="header-clickable d-flex align-items-center" style="flex: 1">
                    <h6 class="mb-0">Loop Block</h6>
                    <span class="collapse-indicator">▼</span>
                </div>
                <div class="iteration-controls">
                    <div class="input-group input-group-sm">
                        <button class="btn btn-outline-secondary decrease-iterations" type="button">-</button>
                        <input type="number" class="form-control iterations-input" 
                               value="1" min="1">
                        <button class="btn btn-outline-secondary increase-iterations" type="button">+</button>
                    </div>
                    <span class="ms-2">times</span>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn ms-2">×</button>
                </div>
            </div>
            <div class="nested-blocks mt-2"></div>
            <div class="btn-group mt-2 w-100">
                <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-btn">Add Loop</button>
            </div>
        `;

        // Add click handler for collapse
        const header = blockElement.querySelector('.header-clickable');
        const nestedBlocks = blockElement.querySelector('.nested-blocks');

        header.addEventListener('click', (e) => {
            if (!e.target.closest('.btn') && !e.target.closest('.iteration-controls')) {
                blockElement.classList.toggle('collapsed');
                nestedBlocks.classList.toggle('collapsed');
            }
        });

        // Add event listeners for nested block buttons
        blockElement.querySelector('.add-tap-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            addBlockToFunction('tap', blockElement);
        });

        blockElement.querySelector('.add-loop-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            addBlockToFunction('loop', blockElement);
        });

        // Add event listeners for iterations
        const iterationsInput = blockElement.querySelector('.iterations-input');
        const decreaseBtn = blockElement.querySelector('.decrease-iterations');
        const increaseBtn = blockElement.querySelector('.increase-iterations');

        decreaseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentValue = parseInt(iterationsInput.value) || 1;
            if (currentValue > 1) {
                iterationsInput.value = currentValue - 1;
                block.iterations = currentValue - 1;
                scheduleAutosave();
            }
        });

        increaseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentValue = parseInt(iterationsInput.value) || 1;
            iterationsInput.value = currentValue + 1;
            block.iterations = currentValue + 1;
            scheduleAutosave();
        });

        iterationsInput.addEventListener('change', (e) => {
            e.stopPropagation();
            const value = parseInt(e.target.value) || 1;
            if (value < 1) {
                e.target.value = 1;
                block.iterations = 1;
            } else {
                block.iterations = value;
            }
            scheduleAutosave();
        });
    } else { // Tap block
        blockElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Tap Block</h6>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary select-region-btn">Set Region</button>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <small class="text-muted">No region set</small>
        `;

        blockElement.querySelector('.select-region-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            startTapRegionSelection(blockElement);
        });
    }

    // Add remove button handler
    blockElement.querySelector('.remove-block-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        blockElement.remove();
        scheduleAutosave();
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
                block.blocks = [];

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
        }

        nameInput.value = '';
        descriptionInput.value = '';
        blocksContainer.innerHTML = '';

        logToConsole('Function saved successfully', 'success');
    } catch (error) {
        logToConsole('Error saving function: ' + error.message, 'error');
    }
}

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
        blocks: func.blocks, // Store the function's blocks for reference
        functionId: func.id
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole(`Added function: ${func.name}`, 'success');
}

function collectBlockData(block) {
    const data = {
        type: block.type,
        name: block.name
    };

    if (block.type === 'tap' && block.region) {
        data.region = block.region;
    } else if (block.type === 'loop') {
        data.iterations = block.iterations || 1;
        if (block.blocks) {
            data.blocks = block.blocks.map(b => collectBlockData(b));
        }
    } else if (block.type === 'function') {
        data.description = block.description;
        data.functionId = block.functionId;
        if (block.blocks) {
            data.blocks = block.blocks.map(b => collectBlockData(b));
        }
    } else if (block.type === 'conditional') {
        data.threshold = block.data.threshold;
        data.referenceImage = block.data.referenceImage;
        if (block.data.thenBlocks) {
            data.thenBlocks = block.data.thenBlocks.map(b => collectBlockData(b));
        }
        if (block.data.elseBlocks) {
            data.elseBlocks = block.data.elseBlocks.map(b => collectBlockData(b));
        }
    } else if (block.type === 'url') {
        data.url = block.url;
    }

    return data;
}

async function saveBlocks(taskId, blocks) {
    try {
        const processedBlocks = blocks.map(block => collectBlockData(block));

        const response = await fetch(`/api/tasks/${taskId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: processedBlocks
            })
        });

        if (!response.ok) throw new Error('Failed to save blocks');
        logToConsole('Blocks saved successfully', 'success');
    } catch (error) {
        logToConsole('Error saving blocks: ' + error.message, 'error');
    }
}

function captureVideoFrame() {
    const video = document.getElementById('bgVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg').split(',')[1]; // Return base64 data
}

function addConditionalBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'conditional',
        name: 'Conditional Block',
        data: {
            threshold: 90,  // Default similarity threshold
            referenceImage: null,
            thenBlocks: [],  // Blocks to execute if similarity >= threshold
            elseBlocks: []   // Blocks to execute if similarity < threshold
        }
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Conditional block added', 'success');
}

async function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks || !state.currentTask.blocks.length) {
        logToConsole('No blocks to execute', 'error');
        return;
    }

    logToConsole('Starting task execution', 'info');
    let delay = 0;
    const delayIncrement = 800;

    async function executeBlocks(blocks) {
        for (const block of blocks) {
            if (block.type === 'function') {
                // Find the function definition
                const func = functions.find(f => f.name === block.name);
                if (func && func.blocks) {
                    // Execute the function's blocks
                    await executeBlocks(func.blocks);
                } else {
                    logToConsole(`Function "${block.name}" not found`, 'error');
                }
            } else if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    await executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += delayIncrement;
                setTimeout(() => {
                    const coords = showTapFeedback(block.region);
                    logToConsole(`Executed tap at coordinates (${Math.round(coords.x)},${Math.round(coords.y)})`, 'success');
                }, delay);
            } else if (block.type === 'conditional') {
                const currentImage = captureVideoFrame();
                try {
                    const response = await fetch(`/api/blocks/${block.id}/compare-image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: currentImage })
                    });

                    if (!response.ok) throw new Error('Failed to compare images');

                    const result = await response.json();
                    const blocksToExecute = result.similarity >= result.threshold ?
                        block.data.thenBlocks : block.data.elseBlocks;

                    logToConsole(`Image similarity: ${result.similarity.toFixed(1)}% (threshold: ${result.threshold}%)`, 'info');
                    await executeBlocks(blocksToExecute);
                } catch (error) {
                    logToConsole('Error executing conditional block: ' + error.message, 'error');
                }
            } else if (block.type === 'url') {
                await executeUrlBlock(block);
            }
        }
    }

    await executeBlocks(state.currentTask.blocks);
    setTimeout(() => {
        logToConsole('Task execution completed', 'success');
    }, delay + delayIncrement);
}

// Add button to UI
document.getElementById('addFunctionBtn').insertAdjacentHTML('beforebegin', `
    <button class="btn btn-outline-info" id="addConditionalBtn">Add Conditional</button>
`);

document.getElementById('addConditionalBtn').addEventListener('click', addConditionalBlock);

// Add beforeunload event listener
window.addEventListener('beforeunload', async (e) => {
    if (state.currentTask) {
        e.preventDefault();
        e.returnValue = '';
        await saveCurrentTask();
    }
});

function showTapFeedback(region) {
    // Calculate random coordinates within the region
    const x = Math.floor(Math.random() * (region.x2 - region.x1)) + region.x1;
    const y = Math.floor(Math.random() * (region.y2 - region.y1)) + region.y1;

    const feedback = document.createElement('div');
    feedback.className = 'tap-feedback';
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;

    document.getElementById('simulator').appendChild(feedback);
    feedback.addEventListener('animationend', () => feedback.remove());

    // Return the actual coordinates used for logging
    return { x, y };
}

function handleIterationsChange(block, value, iterationsInput) {
    if (value < 1) {
        iterationsInput.value = 1;
        block.iterations = 1;
    } else {
        block.iterations = value;
    }

    // Save immediately after iterations change
    saveCurrentTask().then(() => {
        logToConsole('Iterations updated and saved', 'success');
    }).catch(error => {
        logToConsole('Failed to save iterations update', 'error');
    });
}

async function addFunctionToTask(func) {
    const block = {
        type: 'function',
        name: func.name,
        description: func.description || '',
        blocks: func.blocks,
        functionId: func.id
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole(`Added function: ${func.name}`, 'success');
}

async function deleteFunction(functionId) {
    try {
        const response = await fetch(`/api/functions/${functionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete function');

        window.functions = window.functions.filter(f => f.id !== functionId);
        updateFunctionsList();
        logToConsole('Function deleted successfully', 'success');
    } catch (error) {
        logToConsole('Error deleting function', 'error');
    }
}

async function deleteAllFunctions() {
    if (!confirm('Are you sure you want to delete all functions?')) {
        return;
    }

    try {
        const response = await fetch('/api/functions/all', {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete all functions');

        window.functions = [];
        updateFunctionsList();
        logToConsole('All functions deleted successfully', 'success');
    } catch (error) {
        logToConsole('Error deleting all functions', 'error');
    }
}

// Add URL opening functionality at the end of the file
function openUrlBlock(url) {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'url',
        url: url || 'https://www.google.com',
        description: 'Open URL'
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('URL block added', 'success');
}

function renderUrlBlock(block, blockDiv, index) {
    blockDiv.innerHTML = `
        <<div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">URL Block</h6>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary edit-url-btn">Edit URL</button>
                <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
            </div>
        </div>
        <small class="text-muted url-text">${block.url || 'No URL set'}</small>
    `;

    // Add event handlers
    const editUrlBtn = blockDiv.querySelector('.edit-url-btn');
    editUrlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = prompt('Enter URL:', block.url || 'https://www.google.com');
        if (url) {
            block.url = url;
            blockDiv.querySelector('.url-text').textContent = url;
            scheduleAutosave();
        }
    });

    const removeBtn = blockDiv.querySelector('.remove-block-btn');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBlock(blockDiv);
    });
    return blockDiv;
}

async function executeUrlBlock(block) {
    if (!block.url) {
        logToConsole('No URL specified for URL block', 'error');
        return;
    }

    try {
        window.open(block.url, '_blank');
        logToConsole(`Opened URL: ${block.url}`, 'success');
    } catch (error) {
        logToConsole(`Failed to open URL: ${error.message}`, 'error');
    }
}

function addUrlBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'url',
        url: 'https://www.google.com'  // Default URL,
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('URL block added', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
    const addUrlBtn = document.createElement('button');
    addUrlBtn.className = 'btn btn-outline-secondary';
    addUrlBtn.textContent = 'Add URL';
    addUrlBtn.id = 'addUrlBtn';

    // Find the button group and add the new button
    const btnGroup = document.querySelector('.btn-group.w-100.mb-3');
    if (btnGroup) {
        btnGroup.appendChild(addUrlBtn);
        addUrlBtn.addEventListener('click', addUrlBlock);
    }
});

const originalRenderBlock = renderBlock;
renderBlock = function(block, index) {
    if (block.type === 'url') {
        const blockDiv = document.createElement('div');
        blockDiv.className = `block url-block`;
        blockDiv.dataset.index = index;
        return renderUrlBlock(block, blockDiv, index);
    }
    return originalRenderBlock(block, index);
};

const originalExecuteBlocks = executeBlocks;
executeBlocks = async function(blocks) {
    for (const block of blocks) {
        if (block.type === 'url') {
            await executeUrlBlock(block);
        } else {
            await originalExecuteBlocks([block]); // Execute single block using original function
        }
    }
};