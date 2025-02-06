let tasks = [];
let currentTask = null;
let deletedTasks = [];
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionRectangle = null;
let currentTapBlock = null;
let focusedBlock = null;

document.addEventListener('DOMContentLoaded', () => {
    selectionRectangle = document.getElementById('selectionBox');
    document.getElementById('newTaskBtn').addEventListener('click', createNewTask);
    document.getElementById('executeBtn').addEventListener('click', executeSelectedTask);
    document.getElementById('toggleTasksBtn').addEventListener('click', toggleTasksSidebar);

    const simulator = document.getElementById('simulator');
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Load saved tasks from localStorage
    loadSavedTasks();
});

function toggleTasksSidebar() {
    const sidebar = document.getElementById('tasksSidebar');
    sidebar.classList.toggle('show');
}

function createNewTask() {
    const task = {
        id: `task-${Date.now()}`,
        name: 'New Task',
        blocks: [],
        minimized: false,
        created: new Date().toISOString()
    };
    tasks.push(task);
    currentTask = task;

    // Update the current task display
    const currentTaskElement = document.getElementById('currentTask');
    currentTaskElement.innerHTML = '';
    addTaskBlock(task);

    // Auto-save
    saveTasksToStorage();
    updateTaskList();

    logLiveConsole('New task created', 'info');
}

function saveTasksToStorage() {
    localStorage.setItem('savedTasks', JSON.stringify(tasks));
    localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
}

function loadSavedTasks() {
    const savedTasks = localStorage.getItem('savedTasks');
    const savedDeletedTasks = localStorage.getItem('deletedTasks');

    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    if (savedDeletedTasks) {
        deletedTasks = JSON.parse(savedDeletedTasks);
    }

    updateTaskList();
    updateDeletedTaskList();
}

function updateTaskList() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-list-item';
        if (currentTask && currentTask.id === task.id) {
            taskItem.classList.add('active');
        }

        taskItem.innerHTML = `
            <span>${task.name}</span>
            <div>
                <button class="btn btn-sm btn-outline-danger delete-task-btn">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        `;

        // Make the entire task item clickable
        taskItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-task-btn')) {
                loadTask(task);
                // Update active state
                document.querySelectorAll('.task-list-item').forEach(item => item.classList.remove('active'));
                taskItem.classList.add('active');
            }
        });

        taskItem.querySelector('.delete-task-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task);
        });

        taskList.appendChild(taskItem);
    });
}

function updateDeletedTaskList() {
    const deletedList = document.getElementById('deletedTaskList');
    deletedList.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            ${deletedTasks.length > 0 ? `
                <button class="btn btn-sm btn-outline-danger clear-all-btn">
                    Clear All
                </button>
            ` : ''}
        </div>
    `;

    deletedTasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-list-item';
        taskItem.innerHTML = `
            <span>${task.name}</span>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-success restore-btn" title="Restore task">
                    <i data-feather="refresh-cw"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger remove-btn" title="Delete permanently">
                    <i data-feather="x"></i>
                </button>
            </div>
        `;

        taskItem.querySelector('.restore-btn').addEventListener('click', () => restoreTask(task));
        taskItem.querySelector('.remove-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to permanently delete this task?')) {
                permanentlyDeleteTask(task);
            }
        });

        deletedList.appendChild(taskItem);
    });

    if (deletedTasks.length > 0) {
        const clearAllBtn = deletedList.querySelector('.clear-all-btn');
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to permanently delete all tasks in the recently deleted list?')) {
                clearAllDeletedTasks();
            }
        });
    }
}

function deleteTask(task) {
    const index = tasks.findIndex(t => t.id === task.id);
    if (index > -1) {
        const deletedTask = tasks.splice(index, 1)[0];
        deletedTasks.push(deletedTask);

        if (currentTask && currentTask.id === task.id) {
            currentTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
            if (currentTask) {
                loadTask(currentTask);
            } else {
                document.getElementById('currentTask').innerHTML = '';
            }
        }

        saveTasksToStorage();
        updateTaskList();
        updateDeletedTaskList();
        logLiveConsole('Task moved to recently deleted', 'info');
    }
}

function restoreTask(task) {
    const index = deletedTasks.findIndex(t => t.id === task.id);
    if (index > -1) {
        const restoredTask = deletedTasks.splice(index, 1)[0];
        tasks.push(restoredTask);

        saveTasksToStorage();
        updateTaskList();
        updateDeletedTaskList();
        logLiveConsole('Task restored', 'success');
    }
}

function executeSelectedTask() {
    if (!currentTask) {
        logLiveConsole('No task selected', 'error');
        return;
    }

    // Clear any existing focus
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock = null;
    }

    logLiveConsole('Starting task execution', 'info');

    let delay = 0;
    // Get blocks in DOM order
    const blockElements = document.querySelectorAll('.block');
    blockElements.forEach((blockElement) => {
        const blockIndex = Array.from(blockElement.parentNode.children).indexOf(blockElement);
        const block = currentTask.blocks[blockIndex];

        if (block && block.type === 'tap') {
            const waitTime = Math.random() * 1.5 + 0.5;
            delay += waitTime * 1000;

            setTimeout(() => {
                if (block.region) {
                    const randomX = block.region.x1 + Math.random() * (block.region.x2 - block.region.x1);
                    const randomY = block.region.y1 + Math.random() * (block.region.y2 - block.region.y1);
                    simulateTap(randomX, randomY);
                    logLiveConsole(`Tapping at (${Math.round(randomX)}, ${Math.round(randomY)})`, 'success');
                } else {
                    logLiveConsole('Warning: Tap block has no region defined', 'warning');
                }
            }, delay);
        }
    });

    setTimeout(() => {
        logLiveConsole('Task execution completed', 'success');
    }, delay + 500);
}

function addTaskBlock(task) {
    const currentTaskElement = document.getElementById('currentTask');
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    taskDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="task-name mb-0" contenteditable="true">${task.name}</h5>
            <div>
                <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-btn">Add Loop</button>
                <button class="btn btn-sm btn-outline-danger delete-task-btn">Delete</button>
            </div>
        </div>
        <div class="blocks-container"></div>
    `;

    // Add task name editing functionality
    const nameElement = taskDiv.querySelector('.task-name');
    nameElement.addEventListener('blur', () => {
        task.name = nameElement.textContent;
        saveTasksToStorage(); //Auto-save on name change
        updateTaskList();
    });

    taskDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(tapDiv);
        saveTasksToStorage(); // Auto-save after adding a tap block
    });

    taskDiv.querySelector('.add-loop-btn').addEventListener('click', () => {
        const loopDiv = addLoopBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(loopDiv);
        saveTasksToStorage(); // Auto-save after adding a loop block
    });

    taskDiv.querySelector('.delete-task-btn').addEventListener('click', () => {
        removeTask(task.id);
        taskDiv.remove();
        saveTasksToStorage(); // Auto-save after deleting a task
    });

    currentTaskElement.appendChild(taskDiv);
}

function removeTask(taskId) {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index > -1) {
        tasks.splice(index, 1);
        if (currentTask && currentTask.id === taskId) {
            currentTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
        }
        logLiveConsole('Task removed', 'info');
    }
}

function startSelection(event) {
    if (!currentTapBlock) return;

    isSelecting = true;
    const rect = event.target.getBoundingClientRect();
    selectionStartX = event.clientX - rect.left;
    selectionStartY = event.clientY - rect.top;

    selectionRectangle.style.left = `${selectionStartX}px`;
    selectionRectangle.style.top = `${selectionStartY}px`;
    selectionRectangle.style.width = '0';
    selectionRectangle.style.height = '0';
    selectionRectangle.classList.remove('d-none');
}

function updateSelection(event) {
    if (!isSelecting) return;

    const rect = event.target.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const width = currentX - selectionStartX;
    const height = currentY - selectionStartY;

    selectionRectangle.style.width = `${Math.abs(width)}px`;
    selectionRectangle.style.height = `${Math.abs(height)}px`;
    selectionRectangle.style.left = `${width < 0 ? currentX : selectionStartX}px`;
    selectionRectangle.style.top = `${height < 0 ? currentY : selectionStartY}px`;
}

function stopSelection(event) {
    if (!isSelecting) return;

    isSelecting = false;
    const rect = event.target.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    if (currentTapBlock) {
        currentTapBlock.region = {
            x1: Math.min(selectionStartX, endX),
            y1: Math.min(selectionStartY, endY),
            x2: Math.max(selectionStartX, endX),
            y2: Math.max(selectionStartY, endY)
        };
        showSelectionBox(currentTapBlock);
        logLiveConsole('Tap region set', 'success');
    }

    selectionRectangle.classList.add('d-none');
    disableDrawingMode();
}

function setBlockFocus(block, element) {
    // Remove focus from previous block if exists
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
    }

    // Hide all selection boxes
    document.querySelectorAll('.active-selection-box').forEach(box => {
        box.classList.add('d-none');
    });

    // Set focus on new block
    focusedBlock = { block, element };
    element.classList.add('focused');

    // Show region for tap blocks
    if (block.type === 'tap' && block.region) {
        showSelectionBox(block);
    }
}

function showSelectionBox(tapBlock) {
    if (!tapBlock.region) return;

    // Create a new selection box if one doesn't exist for this tap block
    if (!tapBlock.selectionBoxElement) {
        const newBox = document.createElement('div');
        newBox.className = 'active-selection-box';
        document.getElementById('simulator').appendChild(newBox);
        tapBlock.selectionBoxElement = newBox;
    }

    // Update the position and size
    tapBlock.selectionBoxElement.style.left = `${tapBlock.region.x1}px`;
    tapBlock.selectionBoxElement.style.top = `${tapBlock.region.y1}px`;
    tapBlock.selectionBoxElement.style.width = `${tapBlock.region.x2 - tapBlock.region.x1}px`;
    tapBlock.selectionBoxElement.style.height = `${tapBlock.region.y2 - tapBlock.region.y1}px`;
    tapBlock.selectionBoxElement.classList.remove('d-none');
}

function hideSelectionBox(tapBlock) {
    if (tapBlock.selectionBoxElement) {
        tapBlock.selectionBoxElement.classList.add('d-none');
    }
}

function logLiveConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageDiv = document.createElement('div');
    messageDiv.className = `text-${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
}


function loadTask(task) {
    currentTask = task;
    const currentTaskElement = document.getElementById('currentTask');
    currentTaskElement.innerHTML = '';

    // Create the task container
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    taskDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="task-name mb-0" contenteditable="true">${task.name}</h5>
            <div>
                <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-btn">Add Loop</button>
                <button class="btn btn-sm btn-outline-danger delete-task-btn">Delete</button>
            </div>
        </div>
        <div class="blocks-container"></div>
    `;

    // Add event listeners
    const nameElement = taskDiv.querySelector('.task-name');
    nameElement.addEventListener('blur', () => {
        task.name = nameElement.textContent;
        saveTasksToStorage();
        updateTaskList();
    });

    const blocksContainer = taskDiv.querySelector('.blocks-container');

    taskDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(currentTask);
        blocksContainer.appendChild(tapDiv);
        saveTasksToStorage();
    });

    taskDiv.querySelector('.add-loop-btn').addEventListener('click', () => {
        const loopDiv = addLoopBlock(currentTask);
        blocksContainer.appendChild(loopDiv);
        saveTasksToStorage();
    });

    taskDiv.querySelector('.delete-task-btn').addEventListener('click', () => {
        deleteTask(currentTask);
        taskDiv.remove();
        saveTasksToStorage();
    });

    currentTaskElement.appendChild(taskDiv);

    // Clear existing visual elements
    document.querySelectorAll('.active-selection-box').forEach(box => box.remove());

    // Rebuild blocks from task data
    if (task.blocks && task.blocks.length > 0) {
        task.blocks.forEach((block, index) => {
            let blockDiv;
            if (block.type === 'tap') {
                blockDiv = addTapBlock(task);
                const lastBlock = task.blocks[task.blocks.length - 1];

                // Copy properties from saved block to new block
                lastBlock.name = block.name;
                lastBlock.region = block.region;

                if (block.region) {
                    // Create and show selection box
                    const selectionBoxElement = document.createElement('div');
                    selectionBoxElement.className = 'active-selection-box';
                    document.getElementById('simulator').appendChild(selectionBoxElement);
                    lastBlock.selectionBoxElement = selectionBoxElement;
                    showSelectionBox(lastBlock);
                }
            } else if (block.type === 'loop') {
                blockDiv = addLoopBlock(task);
            }

            if (blockDiv) {
                blocksContainer.appendChild(blockDiv);
            }
        });
    }

    updateTaskList();
    logLiveConsole(`Loaded task: ${task.name}`, 'info');
}

function enableDrawingMode(tapBlock, tapDiv) {
    // Hide all other selection boxes first
    document.querySelectorAll('.active-selection-box').forEach(box => {
        box.classList.add('d-none');
    });

    currentTapBlock = tapBlock;
    tapDiv.classList.add('active-block');
    logLiveConsole('Drawing mode enabled - Select tap region', 'info');
}

function disableDrawingMode() {
    const activeBlock = document.querySelector('.active-block');
    if (activeBlock) {
        activeBlock.classList.remove('active-block');
    }
    currentTapBlock = null;
}

// Event listeners for drawing mode
document.addEventListener('click', (e) => {
    if (!e.target.closest('.block') && currentTapBlock) {
        disableDrawingMode();
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && currentTapBlock) {
        disableDrawingMode();
    }
});


function addTapBlock(parent) {
    const tapBlock = {
        type: 'tap',
        region: null,
        name: 'Tap Block'
    };
    parent.blocks.push(tapBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block tap-block';
    blockDiv.draggable = true;
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name" contenteditable="true">${tapBlock.name}</h6>
            <button class="btn btn-sm btn-outline-primary select-region-btn">Select Region</button>
        </div>
    `;

    setupDragAndDrop(blockDiv);

    // Setup event listeners and drag-and-drop
    blockDiv.querySelector('.delete-dot').addEventListener('click', () => {
        const index = parent.blocks.indexOf(tapBlock);
        if (index > -1) {
            parent.blocks.splice(index, 1);
            blockDiv.remove();
            logLiveConsole('Tap block removed', 'info');
            saveTasksToStorage(); //Auto-save after deleting a block
        }
    });

    blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
        enableDrawingMode(tapBlock, blockDiv);
    });

    blockDiv.addEventListener('click', (e) => {
        if (!e.target.closest('.select-region-btn') && !e.target.closest('.delete-dot')) {
            setBlockFocus(tapBlock, blockDiv);
        }
    });

    // Auto-focus new tap block
    setTimeout(() => setBlockFocus(tapBlock, blockDiv), 0);

    return blockDiv;
}

function addLoopBlock(task) {
    const loopDiv = document.createElement('div');
    loopDiv.className = 'loop-block';
    loopDiv.innerHTML = `<p contenteditable="true">Loop Block</p>`;
    task.blocks.push({type: 'loop'});
    return loopDiv;
}


function generateGCode() {
    //Implementation for generating G-Code
    logLiveConsole("Generating G-Code", "info");
}

// Placeholder functions -  These need actual implementations
function setupDragAndDrop(blockDiv) {}
function simulateTap(x, y) {}

function permanentlyDeleteTask(task) {
    const index = deletedTasks.findIndex(t => t.id === task.id);
    if (index > -1) {
        deletedTasks.splice(index, 1);
        saveTasksToStorage();
        updateDeletedTaskList();
        logLiveConsole('Task permanently deleted', 'info');
    }
}

function clearAllDeletedTasks() {
    deletedTasks = [];
    saveTasksToStorage();
    updateDeletedTaskList();
    logLiveConsole('All deleted tasks cleared', 'info');
}