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
    focusedBlock: null,  // Track currently focused block
    lastTaskId: localStorage.getItem('lastTaskId'), // Track last opened task
    currentFrame: null  // Store current video frame
};

// Functions state
let functions = [];

// Add this function near the start of the file, after state initialization
function addConditionalBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'conditional',
        name: 'Logic Block',  // Updated name
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
    logToConsole('Added Logic block', 'success');  // Updated message
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
    const addConditionalBtn = document.getElementById('addConditionalBtn');
    const newTaskBtn = document.getElementById('newTaskBtn');
    const deleteAllTasksBtn = document.getElementById('deleteAllTasksBtn');
    const addFunctionTapBtn = document.getElementById('addFunctionTapBtn');
    const addFunctionLoopBtn = document.getElementById('addFunctionLoopBtn');
    const saveFunctionBtn = document.getElementById('saveFunctionBtn');


    if (executeTaskBtn) {
        executeTaskBtn.addEventListener('click', executeTask);
    }

    if (addTapBtn) {
        addTapBtn.addEventListener('click', () => {
            if (!state.currentTask) {
                logToConsole('Please create or select a task first', 'error');
                return;
            }
            addTapBlock();
        });
    }

    if (addLoopBtn) {
        addLoopBtn.addEventListener('click', () => {
            if (!state.currentTask) {
                logToConsole('Please create or select a task first', 'error');
                return;
            }
            addLoopBlock();
        });
    }

    if (addConditionalBtn) {
        addConditionalBtn.addEventListener('click', addConditionalBlock);
    }

    if (newTaskBtn) {
        newTaskBtn.addEventListener('click', async () => {
            try {
                await createNewTask();
                logToConsole('New task created successfully', 'success');
            } catch (error) {
                logToConsole('Failed to create new task: ' + error.message, 'error');
            }
        });
    }

    if (deleteAllTasksBtn) {
        deleteAllTasksBtn.addEventListener('click', async () => {
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

                // Create a new task
                const newTask = await createNewTask();
                await loadTask(newTask.id);

                updateTaskList();
                updateTaskDisplay();
                logToConsole('All tasks deleted and new task created', 'success');
            } catch (error) {
                logToConsole('Error deleting all tasks', 'error');
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

    // Selection events
    if (simulator) {
        simulator.addEventListener('mousedown', startSelection);
        simulator.addEventListener('mousemove', updateSelection);
        simulator.addEventListener('mouseup', stopSelection);
        simulator.addEventListener('mouseleave', (event) => {
            if (isSelecting) {
                const rect = simulator.getBoundingClientRect();
                const lastKnownX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
                const lastKnownY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
                finishSelection(lastKnownX, lastKnownY);
            }
        });
    }

    // Initialize
    setupVideoSharing();
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
    if (saveFunctionBtn) {
        saveFunctionBtn.addEventListener('click', saveFunction);
    }
    if (addFunctionTapBtn) addFunctionTapBtn.addEventListener('click', () => addBlockToFunction('tap'));
    if (addFunctionLoopBtn) addFunctionLoopBtn.addEventListener('click', () => addBlockToFunction('loop'));

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
            let taskToLoad;

            // Try to load last opened task
            if (state.lastTaskId) {
                taskToLoad = state.tasks.find(t => t.id === parseInt(state.lastTaskId));
            }

            // If no last task or it doesn't exist, load most recent
            if (!taskToLoad) {
                taskToLoad = state.tasks.reduce((latest, current) => {
                    const latestDate = new Date(latest.updated_at);
                    const currentDate = new Date(current.updated_at);
                    return currentDate > latestDate ? current : latest;
                }, state.tasks[0]);
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

// Update createNewTask function to properly handle task creation and state updates
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

        // Update state with the new task
        state.tasks.push(task);

        // Set the new task as current
        state.currentTask = {
            id: task.id,
            blocks: []
        };

        // Save last opened task ID
        state.lastTaskId = task.id;
        localStorage.setItem('lastTaskId', task.id);

        // Update UI
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
        state.currentTask = {
            id: taskId,
            blocks: blocks.map(block => {
                // Ensure all properties are properly loaded
                if (block.type === 'tap') {
                    return {
                        ...block,
                        region: block.region || null
                    };
                } else if (block.type === 'loop') {
                    return {
                        ...block,
                        iterations: block.iterations || 1,
                        blocks: (block.blocks || []).map(nestedBlock => ({
                            ...nestedBlock,
                            region: nestedBlock.region || null
                        }))
                    };
                } else if (block.type === 'conditional') {
                    return {
                        ...block,
                        data: {
                            ...block.data,
                            threshold: block.data.threshold || 90,
                            referenceImage: block.data.referenceImage || null,
                            thenBlocks: block.data.thenBlocks || [],
                            elseBlocks: block.data.elseBlocks || []
                        }
                    }
                }
                return block;
            })
        };

        // Save last opened task ID
        state.lastTaskId = taskId;
        localStorage.setItem('lastTaskId', taskId);

        const taskTitle = document.getElementById('taskTitle');
        taskTitle.value = state.tasks.find(t => t.id === taskId)?.name || '';
        updateTaskDisplay();
        updateTaskList();
        logToConsole(`Loaded task ${taskId}`, 'success');
    } catch (error) {
        logToConsole('Error loading task blocks', 'error');
        throw error;
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
    scheduleAutosave();
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

    let targetBlocks = state.currentTask.blocks;
    let targetIndex = parseInt(indices[0]);

    // Handle nested blocks in conditionals
    if (indices.length > 1) {
        if (indices[1] === 'then' || indices[1] === 'else') {
            const parentBlock = targetBlocks[indices[0]];
            targetBlocks = parentBlock.data[`${indices[1]}Blocks`];
            targetIndex = parseInt(indices[2]);
        } else {
            // Handle nested blocks in loops
            const parentBlock = targetBlocks[indices[0]];
            targetBlocks = parentBlock.blocks;
            targetIndex = parseInt(indices[1]);
        }
    }

    targetBlocks.splice(targetIndex, 1);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Block removed', 'success');
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

// Save blocks functionality
async function saveCurrentTask() {
    if (!state.currentTask) return;

    try {
        const response = await fetch(`/api/tasks/${state.currentTask.id}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blocks: state.currentTask.blocks
            })
        });

        if (!response.ok) throw new Error('Failed to save blocks');
        logToConsole('Task saved', 'success');
    } catch (error) {
        logToConsole('Failed to save task', 'error');
        throw error;
    }
}

// Enhance scheduleAutosave to provide immediate feedback
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
                <h6 class="mb-0">${block.name}</h6>
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

        // Add event listeners with stopPropagation
        const addTapBtn = blockDiv.querySelector('.add-tap-to-function-btn');
        addTapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addBlockToFunction('tap', blockDiv);
            updateTaskDisplay();
            scheduleAutosave();
        });

        const addLoopBtn = blockDiv.querySelector('.add-loop-to-function-btn');
        addLoopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addBlockToFunction('loop', blockDiv);
            updateTaskDisplay();
            scheduleAutosave();
        });

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
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
        const regionText = block.region ?
            `(${Math.round(block.region.x1)},${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)},${Math.round(block.region.y2)})` :
            'No region set';

        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Tap Block</h6>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <small class="text-muted">Region: ${regionText}</small>
        `;

        // Make the entire block clickable for region selection
        blockDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.btn')) {
                e.stopPropagation();
                setBlockFocus(block, blockDiv);
                enableDrawingMode(block, blockDiv);
            }
        });

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeBlock(blockDiv);
            });
        }
    } else if (block.type === 'loop') {
        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Loop Block</h6>
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

        const iterationsInput = blockDiv.querySelector('.iterations-input');
        const decreaseBtn = blockDiv.querySelector('.decrease-iterations');
        const increaseBtn = blockDiv.querySelector('.increase-iterations');

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

        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeBlock(blockDiv);
            });
        }

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
                        ${block.data?.referenceImage ? 'Update Reference' : 'Capture Reference'}
                    </button>
                    <input type="number" class="form-control form-control-sm threshold-input" 
                           value="${block.data?.threshold || 90}" min="0" max="100" style="width: 70px">
                    <span class="ms-2 me-2">% similar</span>
                    <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                </div>
            </div>
            <div class="mt-2">
                <div class="nested-blocks then-blocks">
                    <p class="mb-2">IF similar enough:</p>
                    <div class="btn-group w-100 mb-2">
                        <button class="btn btn-sm btn-outline-primary add-then-tap-btn">Add Tap</button>
                        <button class="btn btn-sm btn-outline-success add-then-loop-btn">Add Loop</button>
                    </div>
                </div>
                <div class="nested-blocks else-blocks">
                    <p class="mb-2">ELSE (not similar enough):</p>
                    <div class="btn-group w-100 mb-2">
                        <button class="btn btn-sm btn-outline-primary add-else-tap-btn">Add Tap</button>
                        <button class="btn btn-sm btn-outline-success add-else-loop-btn">Add Loop</button>
                    </div>
                </div>
            </div>
        `;

        // Add delete button handler
        const removeBtn = blockDiv.querySelector('.remove-block-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeBlock(blockDiv);
            });
        }

        // Capture/Update reference image button
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

        // Threshold input handler
        const thresholdInput = blockDiv.querySelector('.threshold-input');
        thresholdInput.addEventListener('change', (e) => {
            block.data.threshold = parseInt(e.target.value) || 90;
            scheduleAutosave();
        });

        // Add buttons for then/else blocks
        const addThenTapBtn = blockDiv.querySelector('.add-then-tap-btn');
        const addThenLoopBtn = blockDiv.querySelector('.add-then-loop-btn');
        const addElseTapBtn = blockDiv.querySelector('.add-else-tap-btn');
        const addElseLoopBtn = blockDiv.querySelector('.add-else-loop-btn');

        if (addThenTapBtn) {
            addThenTapBtn.addEventListener('click', () => {
                const tapBlock = {
                    type: 'tap',
                    region: null,
                    name: 'Tap Block'
                };
                if (!block.data.thenBlocks) block.data.thenBlocks = [];
                block.data.thenBlocks.push(tapBlock);
                updateTaskDisplay();
                scheduleAutosave();
            });
        }

        if (addThenLoopBtn) {
            addThenLoopBtn.addEventListener('click', () => {
                const loopBlock = {
                                        type: 'loop',
                    iterations: 1,
                    blocks: [],
                    name: 'Loop Block'
                };
                if (!block.data.thenBlocks) block.data.thenBlocks = [];
                block.data.thenBlocks.push(loopBlock);
                updateTaskDisplay();
                scheduleAutosave();
            });
        }

        if (addElseTapBtn) {
            addElseTapBtn.addEventListener('click', () => {
                const tapBlock = {
                    type: 'tap',
                    region: null,
                    name: 'Tap Block'
                };
                if (!block.data.elseBlocks) block.data.elseBlocks = [];
                block.data.elseBlocks.push(tapBlock);
                updateTaskDisplay();
                scheduleAutosave();
            });
        }

        if (addElseLoopBtn) {
            addElseLoopBtn.addEventListener('click', () => {
                const loopBlock = {
                    type: 'loop',
                    iterations: 1,
                    blocks: [],
                    name: 'Loop Block'
                };
                if (!block.data.elseBlocks) block.data.elseBlocks = [];
                block.data.elseBlocks.push(loopBlock);
                updateTaskDisplay();
                scheduleAutosave();
            });
        }

        // Render nested blocks
        if (block.data.thenBlocks) {
            const thenContainer = blockDiv.querySelector('.then-blocks');
            block.data.thenBlocks.forEach((nestedBlock, nestedIndex) => {
                thenContainer.appendChild(renderBlock(nestedBlock, `${index}.then.${nestedIndex}`));
            });
        }

        if (block.data.elseBlocks) {
            const elseContainer = blockDiv.querySelector('.else-blocks');
            block.data.elseBlocks.forEach((nestedBlock, nestedIndex) => {
                elseContainer.appendChild(renderBlock(nestedBlock, `${index}.else.${nestedIndex}`));
            });
        }
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
    const delayIncrement = 800; // Increased delay between actions for better visibility

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
                    showTapFeedback(block.region);
                    logToConsole(`Executed tap at region (${Math.round(block.region.x1)},${Math.round(block.region.y1)})`, 'success');
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
    const coordinates = getRandomCoordinatesInRegion(region);

    const feedback = document.createElement('div');
    feedback.className = 'tap-feedback';
    feedback.style.left = `${coordinates.x}px`;
    feedback.style.top = `${coordinates.y}px`;

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
            logToConsole('Screen sharing started','success');        } catch (error) {
            logToConsole('Screen sharing error: ' +error.message, 'error');
        }
    });
}

function logToConsole(message, type= 'info') {
    const console = document.getElementById('liveConsole');
    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageEl);
    console.scrollTop = console.scrollHeight;
}

// Update scheduleAutosave to use the new save function
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
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete task');

        // Remove task from state
        state.tasks = state.tasks.filter(t => t.id !== taskId);

        if (state.tasks.length === 0) {
            // If no tasks remain, create a new one
            const newTask = await createNewTask();
            await loadTask(newTask.id);
            logToConsole('Created new task after deletion', 'success');
        } else if (state.currentTask && state.currentTask.id === taskId) {
            // If deleted current task, load the most recent task
            const mostRecentTask = state.tasks.reduce((latest, current) => {
                const latestDate = new Date(latest.updated_at);
                const currentDate = new Date(current.updated_at);
                return currentDate > latestDate ? current : latest;
            }, state.tasks[0]);

            await loadTask(mostRecentTask.id);
        }

        updateTaskList();
        logToConsole('Task deleted successfully', 'success');
    } catch (error) {
        logToConsole('Error deleting task', 'error');
    }
}

// Update delete all tasks handler
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

        // Create a new task since all are deleted
        const newTask = await createNewTask();
        await loadTask(newTask.id);

        updateTaskList();
        updateTaskDisplay();
        logToConsole('All tasks deleted and new task created', 'success');
    } catch (error) {
        logToConsole('Error deleting all tasks', 'error');
    }
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

// Added functions from edited snippet
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
                <h6 class="mb-0">Loop Block</h6>
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
            const currentValue= parseInt(iterationsInput.value) || 1;
            if (currentValue > 1) {
                iterationsInput.value = currentValue - 1;
                block.iterations = currentValue - 1;
            }
        });

        increaseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentValue = parseInt(iterationsInput.value) || 1;
            iterationsInput.value = currentValue + 1;
            block.iterations = currentValue + 1;
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
        blocks: func.blocks // Store the function's blocks for reference
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole(`Added function: ${func.name}`, 'success');
}

// Update the block data collection in saveBlocks
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
        if (block.blocks) {
            data.blocks = block.blocks.map(b => collectBlockData(b));
        }
    } else if (block.type === 'conditional') {
        data.data = {
            threshold: block.data.threshold,
            referenceImage: block.data.referenceImage,
            thenBlocks: block.data.thenBlocks.map(b => collectBlockData(b)),
            elseBlocks: block.data.elseBlocks.map(b => collectBlockData(b))
        };
    }

    return data;
}

// Update save_blocks endpoint handling
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

// Add new function to capture video frame
function captureVideoFrame() {
    const video = document.getElementById('bgVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg').split(',')[1]; // Return base64 data
}

// Update the executeTask function to handle conditional blocks
async function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks || !state.currentTask.blocks.length) {
        logToConsole('No blocks to execute', 'error');
        return;
    }

    logToConsole('Starting task execution', 'info');
    let delay = 0;
    const delayIncrement = 800; // Increased delay between actions for better visibility

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
                    showTapFeedback(block.region);
                    logToConsole(`Executed tap at region (${Math.round(block.region.x1)},${Math.round(block.region.y1)})`, 'success');
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

// Add this utility function for random coordinates
function getRandomCoordinatesInRegion(region) {
    return {
        x: region.x1 + Math.random() * (region.x2 - region.x1),
        y: region.y1 + Math.random() * (region.y2 - region.y1)
    };
}

// Update showTapFeedback to use random coordinates
function showTapFeedback(region) {
    const coordinates = getRandomCoordinatesInRegion(region);

    const feedback = document.createElement('div');
    feedback.className = 'tap-feedback';
    feedback.style.left = `${coordinates.x}px`;
    feedback.style.top = `${coordinates.y}px`;

    document.getElementById('simulator').appendChild(feedback);

    // Remove the feedback element after animation completes
    feedback.addEventListener('animationend', () => feedback.remove());
}