// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// State management
const state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null // Track block being configured
};

// Selection state
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionBox = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    selectionBox = document.getElementById('selectionBox');
    const simulator = document.getElementById('simulator');

    // Set up event listeners
    document.getElementById('executeTaskBtn').addEventListener('click', executeTask);
    document.getElementById('newTaskBtn').addEventListener('click', createNewTask);
    document.getElementById('addTapBtn').addEventListener('click', () => addTapBlock());
    document.getElementById('addLoopBtn').addEventListener('click', () => addLoopBlock());
    document.getElementById('taskSelect').addEventListener('change', (e) => {
        if (e.target.value) loadTask(parseInt(e.target.value));
    });

    // Selection events
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Video setup
    setupVideoSharing();

    // Load initial tasks
    loadTasks();
});

// Task Management
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to load tasks');

        state.tasks = await response.json();
        updateTaskSelect();

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
        updateTaskSelect();
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
        logToConsole(`Loaded task ${taskId}`, 'success');
    } catch (error) {
        logToConsole('Error loading task blocks', 'error');
    }
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

function addTapBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'tap',
        description: 'Click to set region'
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    logToConsole('Tap block added. Click "Set Region" to configure it.', 'success');
}

function addLoopBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const iterations = prompt('Enter number of iterations:', '1');
    if (!iterations) return;

    const block = {
        type: 'loop',
        iterations: parseInt(iterations) || 1,
        blocks: []
    };

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Loop block added', 'success');
}

// UI Updates
function updateTaskSelect() {
    const select = document.getElementById('taskSelect');
    select.innerHTML = '<option value="">Select a task...</option>' +
        state.tasks.map(task => 
            `<option value="${task.id}"${state.currentTask && state.currentTask.id === task.id ? ' selected' : ''}>${task.name}</option>`
        ).join('');
}

function updateTaskDisplay() {
    const container = document.getElementById('currentTask');
    container.innerHTML = '';

    if (!state.currentTask || !state.currentTask.blocks) return;

    function renderBlock(block, index) {
        const blockEl = document.createElement('div');
        blockEl.className = `block ${block.type}-block`;
        blockEl.dataset.index = index;

        if (block.type === 'tap') {
            const regionText = block.region ?
                `Region: (${Math.round(block.region.x1)}, ${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)}, ${Math.round(block.region.y2)})` :
                'No region set';

            blockEl.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <strong>Tap Block</strong>
                    <div>
                        <button class="btn btn-sm btn-outline-primary set-region-btn">
                            ${block.region ? 'Change Region' : 'Set Region'}
                        </button>
                        <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                    </div>
                </div>
                <small class="text-muted">${regionText}</small>
            `;

            const setRegionBtn = blockEl.querySelector('.set-region-btn');
            setRegionBtn.addEventListener('click', () => startTapRegionSelection(blockEl));
        } else if (block.type === 'loop') {
            blockEl.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <strong>Loop Block</strong>
                    <div class="d-flex align-items-center gap-2">
                        <input type="number" class="form-control form-control-sm iterations-input"
                            value="${block.iterations}" min="1" style="width: 70px">
                        <span>times</span>
                        <button class="btn btn-sm btn-outline-danger remove-block-btn">×</button>
                    </div>
                </div>
                <div class="nested-blocks mt-2"></div>
            `;

            const iterationsInput = blockEl.querySelector('.iterations-input');
            iterationsInput.addEventListener('change', (e) => {
                block.iterations = parseInt(e.target.value) || 1;
                scheduleAutosave();
            });

            const nestedContainer = blockEl.querySelector('.nested-blocks');
            block.blocks.forEach((nestedBlock, nestedIndex) => {
                nestedContainer.appendChild(renderBlock(nestedBlock, `${index}.${nestedIndex}`));
            });
        }

        blockEl.querySelector('.remove-block-btn').addEventListener('click', () => removeBlock(blockEl));
        return blockEl;
    }

    state.currentTask.blocks.forEach((block, index) => {
        container.appendChild(renderBlock(block, index));
    });
}

// Selection Handling
function startSelection(event) {
    if (!isSelecting) return;

    const rect = event.target.getBoundingClientRect();
    selectionStartX = event.clientX - rect.left;
    selectionStartY = event.clientY - rect.top;

    selectionBox.style.left = `${selectionStartX}px`;
    selectionBox.style.top = `${selectionStartY}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.classList.remove('d-none');
}

function updateSelection(event) {
    if (!isSelecting || selectionBox.classList.contains('d-none')) return;

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

    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Region set for tap block', 'success');

    selectionBox.classList.add('d-none');
    isSelecting = false;
    state.pendingBlockConfiguration = null;
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