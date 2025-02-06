let tasks = [];
let currentTask = null;
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionRectangle = null;
let currentTapBlock = null;

document.addEventListener('DOMContentLoaded', () => {
    selectionRectangle = document.getElementById('selectionBox');
    
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
        logLiveConsole('Tap region set', 'success');
    }
    
    selectionRectangle.classList.add('d-none');
    currentTapBlock = null;
}

function logLiveConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageDiv = document.createElement('div');
    messageDiv.className = `text-${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
}
