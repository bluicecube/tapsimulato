let tasks = [];
let currentTask = null;
let savedTasks = [];
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionRectangle = null;
let currentTapBlock = null;
let focusedBlock = null;

document.addEventListener('DOMContentLoaded', () => {
    selectionRectangle = document.getElementById('selectionBox');
    document.getElementById('newTaskBtn').addEventListener('click', createNewTask);
    document.getElementById('saveTaskBtn').addEventListener('click', saveCurrentTask);
    document.getElementById('executeBtn').addEventListener('click', executeSelectedTask);
    document.getElementById('generateGCodeBtn').addEventListener('click', generateGCode);

    const simulator = document.getElementById('simulator');
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Load saved tasks from localStorage
    loadSavedTasks();
});

function createNewTask() {
    const task = {
        id: `task-${Date.now()}`,
        name: 'New Task',
        blocks: [],
        minimized: false
    };
    tasks.push(task);
    currentTask = task;

    // Update the current task display
    const currentTaskElement = document.getElementById('currentTask');
    currentTaskElement.innerHTML = '';
    addTaskBlock(task);

    logLiveConsole('New task created', 'info');
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
                <button class="btn btn-sm btn-outline-info add-print-btn">Add Print</button>
                <button class="btn btn-sm btn-outline-danger delete-task-btn">Delete</button>
            </div>
        </div>
        <div class="blocks-container"></div>
    `;

    // Add task name editing functionality
    const nameElement = taskDiv.querySelector('.task-name');
    nameElement.addEventListener('blur', () => {
        task.name = nameElement.textContent;
    });

    taskDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(tapDiv);
    });

    taskDiv.querySelector('.add-loop-btn').addEventListener('click', () => {
        const loopDiv = addLoopBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(loopDiv);
    });

    taskDiv.querySelector('.add-print-btn').addEventListener('click', () => {
        const printDiv = addPrintBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(printDiv);
    });

    taskDiv.querySelector('.delete-task-btn').addEventListener('click', () => {
        removeTask(task.id);
        taskDiv.remove();
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

    currentTapBlock = null;
}


function saveCurrentTask() {
    if (!currentTask) return;

    const taskIndex = savedTasks.findIndex(t => t.id === currentTask.id);
    if (taskIndex === -1) {
        savedTasks.push(JSON.parse(JSON.stringify(currentTask))); // Deep copy to preserve blocks
    } else {
        savedTasks[taskIndex] = JSON.parse(JSON.stringify(currentTask));
    }

    // Save to localStorage
    localStorage.setItem('savedTasks', JSON.stringify(savedTasks));
    updateTaskList();
    logLiveConsole('Task saved successfully', 'success');
}

function loadSavedTasks() {
    const saved = localStorage.getItem('savedTasks');
    if (saved) {
        savedTasks = JSON.parse(saved);
        updateTaskList();
    }
}

function updateTaskList() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    savedTasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-list-item';
        if (currentTask && currentTask.id === task.id) {
            taskItem.classList.add('active');
        }
        taskItem.textContent = task.name;
        taskItem.addEventListener('click', () => loadTask(task));
        taskList.appendChild(taskItem);
    });
}

function loadTask(task) {
    currentTask = JSON.parse(JSON.stringify(task)); // Deep copy to preserve blocks
    const currentTaskElement = document.getElementById('currentTask');
    currentTaskElement.innerHTML = '';
    addTaskBlock(currentTask);
    updateTaskList();
    logLiveConsole(`Loaded task: ${task.name}`, 'info');
}

function setBlockFocus(block, element) {
    // Remove focus from all blocks
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
    return loopDiv;
}

function addPrintBlock(task) {
    const printDiv = document.createElement('div');
    printDiv.className = 'print-block';
    printDiv.innerHTML = `<p contenteditable="true">Print Block</p>`;
    return printDiv;
}

function executeSelectedTask() {
    //Implementation for executing selected task
    logLiveConsole("Executing selected task", "info");
}

function generateGCode() {
    //Implementation for generating G-Code
    logLiveConsole("Generating G-Code", "info");
}

// Placeholder functions -  These need actual implementations
function setupDragAndDrop(blockDiv) {}
function enableDrawingMode(tapBlock, blockDiv) {}