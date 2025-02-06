let tasks = [];
let currentTask = null;
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionRectangle = null;
let currentTapBlock = null;
let activeSelectionBox = null;

document.addEventListener('DOMContentLoaded', () => {
    selectionRectangle = document.getElementById('selectionBox');
    activeSelectionBox = document.createElement('div');
    activeSelectionBox.className = 'active-selection-box d-none';
    document.getElementById('simulator').appendChild(activeSelectionBox);

    document.getElementById('newTaskBtn').addEventListener('click', createNewTask);
    document.getElementById('executeBtn').addEventListener('click', executeSelectedTask);
    document.getElementById('generateGCodeBtn').addEventListener('click', generateGCode);

    const simulator = document.getElementById('simulator');
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);
});

function createNewTask() {
    const task = {
        id: `task-${Date.now()}`,
        blocks: [],
        minimized: false
    };
    tasks.push(task);
    addTaskBlock(task);
    currentTask = task;
    logLiveConsole('New task created', 'info');
}

function addTaskBlock(task) {
    const taskLog = document.getElementById('taskLog');
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    taskDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="mb-0">Task ${tasks.length}</h5>
            <div>
                <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-btn">Add Loop</button>
                <button class="btn btn-sm btn-outline-info add-print-btn">Add Print</button>
                <button class="btn btn-sm btn-outline-danger delete-task-btn">Delete</button>
            </div>
        </div>
        <div class="blocks-container"></div>
    `;

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

    taskLog.appendChild(taskDiv);
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

function showSelectionBox(tapBlock) {
    if (!tapBlock.region) return;

    activeSelectionBox.style.left = `${tapBlock.region.x1}px`;
    activeSelectionBox.style.top = `${tapBlock.region.y1}px`;
    activeSelectionBox.style.width = `${tapBlock.region.x2 - tapBlock.region.x1}px`;
    activeSelectionBox.style.height = `${tapBlock.region.y2 - tapBlock.region.y1}px`;
    activeSelectionBox.classList.remove('d-none');
}

function hideSelectionBox() {
    activeSelectionBox.classList.add('d-none');
}

function logLiveConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageDiv = document.createElement('div');
    messageDiv.className = `text-${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
}

function addTapBlock(task) {
    const tapDiv = document.createElement('div');
    tapDiv.className = 'tap-block';
    tapDiv.innerHTML = `<p>Tap Block</p>`;
    currentTapBlock = tapDiv;
    return tapDiv;
}

function addLoopBlock(task) {
    const loopDiv = document.createElement('div');
    loopDiv.className = 'loop-block';
    loopDiv.innerHTML = `<p>Loop Block</p>`;
    return loopDiv;
}

function addPrintBlock(task) {
    const printDiv = document.createElement('div');
    printDiv.className = 'print-block';
    printDiv.innerHTML = `<p>Print Block</p>`;
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