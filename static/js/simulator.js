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

        // Render nestedblocks
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

    async function executeBlocks(blocks, parentIndex = null) {
        for (const [index, block] of blocks.entries()) {
            const blockIndex = parentIndex ? `${parentIndex}.${index}` : index.toString();
            const blockElement = document.querySelector(`[data-index="${blockIndex}"]`);
            const progressItem = document.querySelectorAll('.progress-item')[parseInt(blockIndex)];

            if (blockElement) {
                blockElement.classList.add('executing');
            }
            if (progressItem) {
                progressItem.classList.add('completed');
            }

            if (block.type === 'function') {
                const func = functions.find(f => f.name === block.name);
                if (func && func.blocks) {
                    await executeBlocks(func.blocks, blockIndex);
                } else {
                    logToConsole(`Function "${block.name}" not found`, 'error');
                }
            } else if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    await executeBlocks(block.blocks, blockIndex);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += delayIncrement;
                await new Promise(resolve => setTimeout(() => {
                    const coords = showTapFeedback(block.region);
                    logToConsole(`Executed tap at coordinates (${Math.round(coords.x)},${Math.round(coords.y)})`, 'success');
                    resolve();
                }, delayIncrement));
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
                    await executeBlocks(blocksToExecute, blockIndex);
                } catch (error) {
                    logToConsole('Error executing conditional block: ' + error.message, 'error');
                }
            } else if (block.type === 'url') {
                await executeUrlBlock(block);
            }

            if (blockElement) {
                blockElement.classList.remove('executing');

                // Validate function blocks
                if (block.type === 'function' && !validateFunction(block)) {
                    blockElement.classList.add('invalid');
                }
            }
        }
    }

    const startTime = performance.now();
    await executeBlocks(state.currentTask.blocks);
    const executionTime = (performance.now() - startTime) / 1000;
    updateExecutionStats(executionTime);
    logToConsole('Task execution completed', 'success');
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

function logToConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = message;
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

// Update task list with active task highlighting
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

    async function executeBlocks(blocks, parentIndex = null) {
        for (const [index, block] of blocks.entries()) {
            const blockIndex = parentIndex ? `${parentIndex}.${index}` : index.toString();
            const blockElement = document.querySelector(`[data-index="${blockIndex}"]`);
            const progressItem = document.querySelectorAll('.progress-item')[parseInt(blockIndex)];

            if (blockElement) {
                blockElement.classList.add('executing');
            }
            if (progressItem) {
                progressItem.classList.add('completed');
            }

            if (block.type === 'function') {
                const func = functions.find(f => f.name === block.name);
                if (func && func.blocks) {
                    await executeBlocks(func.blocks, blockIndex);
                } else {
                    logToConsole(`Function "${block.name}" not found`, 'error');
                }
            } else if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    await executeBlocks(block.blocks, blockIndex);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += delayIncrement;
                await new Promise(resolve => setTimeout(() => {
                    const coords = showTapFeedback(block.region);
                    logToConsole(`Executed tap at coordinates (${Math.round(coords.x)},${Math.round(coords.y)})`, 'success');
                    resolve();
                }, delayIncrement));
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
                    await executeBlocks(blocksToExecute, blockIndex);
                } catch (error) {
                    logToConsole('Error executing conditional block: ' + error.message, 'error');
                }
            } else if (block.type === 'url') {
                await executeUrlBlock(block);
            }

            if (blockElement) {
                blockElement.classList.remove('executing');

                // Validate function blocks
                if (block.type === 'function' && !validateFunction(block)) {
                    blockElement.classList.add('invalid');
                }
            }
        }
    }

    updateProgressTracker(state.currentTask.blocks);
    const startTime = performance.now();
    try {
        await executeBlocks(state.currentTask.blocks);
        const executionTime = (performance.now() - startTime) / 1000;
        updateExecutionStats(executionTime);
    } catch (error) {
        logToConsole('Error executing task: ' + error.message, 'error');
    }
    logToConsole('Task execution completed', 'success');
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
        return;}

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
        <div class="d-flex justify-content-between align-items-center">
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

// Add tab switching functionality
document.addEventListener('DOMContentLoaded', () => {
    // existing initialization code 

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Show selected content
            document.querySelectorAll('.content-section').forEach(section => section.classList.add('d-none'));
            document.getElementById(button.dataset.tab).classList.remove('d-none');
        });
    });

    // Initialize charts
    initializeCharts();
});

// Progress tracking
function updateProgressTracker(blocks, parentName = '') {
    const progressItems = document.getElementById('progressItems');
    progressItems.innerHTML = '';

    function addProgressItem(block, prefix = '') {
        const item = document.createElement('div');
        item.className = 'progress-item';
        item.innerHTML = `
            <div class="progress-checkbox"></div>
            <div class="progress-label">${prefix}${block.type === 'function' ? block.name : block.type}</div>
        `;
        progressItems.appendChild(item);

        if (block.blocks) {
            block.blocks.forEach(nestedBlock => {
                addProgressItem(nestedBlock, `${prefix}  → `);
            });
        }
    }

    blocks.forEach(block => addProgressItem(block));
}

// Function validation
function validateFunction(block) {
    if (block.type === 'function') {
        const hasUndefinedBlocks = block.blocks.some(b => !b.type || !b.name);
        if (hasUndefinedBlocks) {
            return false;
        }
    }
    return true;
}

// Execution tracking
async function executeTask() {
    if (!state.currentTask || !state.currentTask.blocks) {
        logToConsole('No task selected or empty task', 'error');
        return;
    }

    updateProgressTracker(state.currentTask.blocks);
    const startTime = performance.now();

    try {
        await executeBlocks(state.currentTask.blocks);
        const executionTime = (performance.now() - startTime) / 1000;
        updateExecutionStats(executionTime);
    } catch (error) {
        logToConsole('Error executing task: ' + error.message, 'error');
    }
}

// Financial dashboard
function initializeCharts() {
    // Execution Time Chart
    const timeCtx = document.getElementById('executionTimeChart').getContext('2d');
    new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Task Execution Time (s)',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Task Completion Chart
    const completionCtx = document.getElementById('taskCompletionChart').getContext('2d');
    new Chart(completionCtx, {
        type: 'bar',
        data: {
            labels: ['Completed', 'Failed'],
            datasets: [{
                label: 'Task Completion Status',
                data: [0, 0],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(255, 99, 132, 0.2)'
                ],
                borderColor: [
                    'rgb(75, 192, 192)',
                    'rgb(255, 99, 132)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateExecutionStats(executionTime) {
    const timeChart = Chart.getChart('executionTimeChart');
    const completionChart = Chart.getChart('taskCompletionChart');

    if (timeChart) {
        timeChart.data.labels.push(new Date().toLocaleTimeString());
        timeChart.data.datasets[0].data.push(executionTime);
        if (timeChart.data.labels.length > 10) {
            timeChart.data.labels.shift();
            timeChart.data.datasets[0].data.shift();
        }
        timeChart.update();
    }

    if (completionChart) {
        completionChart.data.datasets[0].data[0]++;
        completionChart.update();
    }
}

// Update existing executeBlocks function
async function executeBlocks(blocks, parentIndex = null) {
    for (const [index, block] of blocks.entries()) {
        const blockIndex = parentIndex ? `${parentIndex}.${index}` : index.toString();
        const blockElement = document.querySelector(`[data-index="${blockIndex}"]`);
        const progressItem = document.querySelectorAll('.progress-item')[parseInt(blockIndex)];

        if (blockElement) {
            blockElement.classList.add('executing');
        }
        if (progressItem) {
            progressItem.classList.add('completed');
        }

        if (block.type === 'function') {
            const func = functions.find(f => f.name === block.name);
            if (func && func.blocks) {
                await executeBlocks(func.blocks, blockIndex);
            } else {
                logToConsole(`Function "${block.name}" not found`, 'error');
            }
        } else if (block.type === 'loop') {
            for (let i = 0; i < block.iterations; i++) {
                await executeBlocks(block.blocks, blockIndex);
            }
        } else if (block.type === 'tap' && block.region) {
            delay += delayIncrement;
            await new Promise(resolve => setTimeout(() => {
                const coords = showTapFeedback(block.region);
                logToConsole(`Executed tap at coordinates (${Math.round(coords.x)},${Math.round(coords.y)})`, 'success');
                resolve();
            }, delayIncrement));
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
                await executeBlocks(blocksToExecute, blockIndex);
            } catch (error) {
                logToConsole('Error executing conditional block: ' + error.message, 'error');
            }
        } else if (block.type === 'url') {
            await executeUrlBlock(block);
        }

        if (blockElement) {
            blockElement.classList.remove('executing');

            // Validate function blocks
            if (block.type === 'function' && !validateFunction(block)) {
                blockElement.classList.add('invalid');
            }
        }
    }
}