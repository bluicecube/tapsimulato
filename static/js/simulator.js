// Galaxy A11 dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;
const PHYSICAL_WIDTH = 76.3; // mm
const PHYSICAL_HEIGHT = 161.4; // mm

// Task management state
let tasks = [];
let currentTask = null;

document.addEventListener('DOMContentLoaded', () => {
    // Existing initialization code
    selectionRectangle = document.getElementById('selectionBox');
    document.getElementById('newTaskBtn').addEventListener('click', createNewTask);
    document.getElementById('runTaskBtn').addEventListener('click', () => {
        const chatInput = document.getElementById('chatInput');
        const sendChatBtn = document.getElementById('sendChatBtn');
        chatInput.value = 'run';
        sendChatBtn.click();
    });
    document.getElementById('toggleTasksBtn').addEventListener('click', toggleTasksSidebar);

    const simulator = document.getElementById('simulator');
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Set simulator size
    simulator.style.width = `${DEVICE_WIDTH}px`;
    simulator.style.height = `${DEVICE_HEIGHT}px`;

    // Set CSS variables for other components
    document.documentElement.style.setProperty('--device-width', `${DEVICE_WIDTH}px`);
    document.documentElement.style.setProperty('--device-height', `${DEVICE_HEIGHT}px`);

    // Initialize video stream functionality
    const setVideoSourceBtn = document.getElementById('setVideoSource');
    const video = document.getElementById('bgVideo');

    // Add screen capture functionality
    setVideoSourceBtn.addEventListener('click', async () => {
        try {
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                },
                audio: false
            });
            video.srcObject = stream;
            logLiveConsole('Screen sharing started successfully', 'success');
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                logLiveConsole('Screen sharing ended', 'info');
                video.srcObject = null;
            });
        } catch (error) {
            logLiveConsole(`Screen sharing error: ${error.message}`, 'error');
            video.srcObject = null;
        }
    });

    // Load saved tasks
    loadSavedTasks();

    // Add Financials navigation
    document.getElementById('financialsLink').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/financials';
    });
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
        created: new Date().toISOString()
    };
    tasks.push(task);
    currentTask = task;
    loadTask(task);
    saveTasksToStorage();
    updateTaskList();
    logLiveConsole('New task created', 'info');
}

function saveTasksToStorage() {
    localStorage.setItem('savedTasks', JSON.stringify(tasks));
}

function loadSavedTasks() {
    const savedTasks = localStorage.getItem('savedTasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    updateTaskList();
}

function updateTaskList() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = ''; // Clear current list

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-list-item d-flex justify-content-between align-items-center';

        // Add active class if this is the current task
        if (currentTask && currentTask.id === task.id) {
            taskItem.classList.add('active');
        }

        taskItem.innerHTML = `
            <span class="task-name">${task.name}</span>
            <button class="btn btn-danger btn-sm delete-task-btn">
                <i data-feather="trash-2"></i>
            </button>
        `;

        // Add click handler for task selection
        taskItem.querySelector('.task-name').addEventListener('click', () => {
            loadTask(task);
            // Update active state
            document.querySelectorAll('.task-list-item').forEach(item => {
                item.classList.remove('active');
            });
            taskItem.classList.add('active');
            logLiveConsole(`Loaded task: ${task.name}`, 'info');
        });

        // Add click handler for delete button
        taskItem.querySelector('.delete-task-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent task selection when deleting
            const index = tasks.findIndex(t => t.id === task.id);
            if (index > -1) {
                tasks.splice(index, 1);
                saveTasksToStorage();
                updateTaskList();

                // If the current task was deleted, clear the current task area
                if (currentTask && currentTask.id === task.id) {
                    currentTask = null;
                    document.getElementById('currentTask').innerHTML = '';
                }

                logLiveConsole(`Deleted task: ${task.name}`, 'info');
            }
        });

        taskList.appendChild(taskItem);
    });

    // Initialize icons
    if (window.feather) {
        feather.replace();
    }
}

function loadTask(task) {
    if (!task) return;

    currentTask = task;
    const currentTaskElement = document.getElementById('currentTask');
    currentTaskElement.innerHTML = '';

    // Create task container
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    taskDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="task-name mb-0" contenteditable="true">${task.name}</h5>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
                <button class="btn btn-sm btn-outline-success add-loop-btn">Add Loop</button>
            </div>
        </div>
        <div class="blocks-container"></div>
    `;

    // Add task name editing functionality
    const nameElement = taskDiv.querySelector('.task-name');
    nameElement.addEventListener('blur', () => {
        task.name = nameElement.textContent;
        saveTasksToStorage();
        updateTaskList();
    });

    // Add tap block functionality
    taskDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(tapDiv);
        saveTasksToStorage();
    });

    // Add loop block functionality
    taskDiv.querySelector('.add-loop-btn').addEventListener('click', () => {
        const loopDiv = addLoopBlock(task);
        taskDiv.querySelector('.blocks-container').appendChild(loopDiv);
        saveTasksToStorage();
    });

    currentTaskElement.appendChild(taskDiv);

    // Load existing blocks
    const blocksContainer = taskDiv.querySelector('.blocks-container');
    task.blocks.forEach(blockData => {
        if (blockData.type === 'tap') {
            const tapDiv = addTapBlock(task, blockData);
            blocksContainer.appendChild(tapDiv);
        } else if (blockData.type === 'loop') {
            const loopDiv = addLoopBlock(task, blockData);
            blocksContainer.appendChild(loopDiv);
        }
    });
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
    const simulator = document.getElementById('simulator');

    function executeBlocks(blocks) {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += Math.random() * 500 + 200; // Random delay between 200-700ms
                setTimeout(() => {
                    // Calculate random point within region
                    const x = block.region.x1 + Math.random() * (block.region.x2 - block.region.x1);
                    const y = block.region.y1 + Math.random() * (block.region.y2 - block.region.y1);

                    // Create visual feedback
                    const feedback = document.createElement('div');
                    feedback.className = 'tap-feedback';
                    feedback.style.left = `${x}px`;
                    feedback.style.top = `${y}px`;

                    simulator.appendChild(feedback);
                    setTimeout(() => feedback.remove(), 500);

                    logLiveConsole(`Tapped at (${Math.round(x)}, ${Math.round(y)})`, 'success');
                }, delay);
            }
        });
    }

    executeBlocks(currentTask.blocks);

    setTimeout(() => {
        logLiveConsole('Task execution completed', 'success');
        // Re-enable all Add Tap buttons after execution
        document.querySelectorAll('.add-tap-btn').forEach(btn => {
            btn.disabled = false;
        });
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
        const index = tasks.findIndex(t => t.id === task.id);
        if (index > -1) {
            tasks.splice(index, 1);
            saveTasksToStorage();
            updateTaskList();
            taskDiv.remove();
            logLiveConsole(`Task deleted: ${task.name}`, 'info');
        }
    });

    currentTaskElement.appendChild(taskDiv);
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
        // Also ensure we remove the active-block class
        focusedBlock.element.classList.remove('active-block');
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
    const selectionBox = tapBlock.selectionBoxElement;
    selectionBox.style.left = `${tapBlock.region.x1}px`;
    selectionBox.style.top = `${tapBlock.region.y1}px`;
    selectionBox.style.width = `${tapBlock.region.x2 - tapBlock.region.x1}px`;
    selectionBox.style.height = `${tapBlock.region.y2 - tapBlock.region.y1}px`;
    selectionBox.classList.remove('d-none');
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


function enableDrawingMode(tapBlock, tapDiv) {
    // Clear any existing focus first
    if (focusedBlock && focusedBlock.element !== tapDiv) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock.element.classList.remove('active-block');
    }

    // Hide all other selection boxes first
    document.querySelectorAll('.active-selection-box').forEach(box => {
        box.classList.add('d-none');
    });

    currentTapBlock = tapBlock;
    tapDiv.classList.add('active-block');
    setBlockFocus(tapBlock, tapDiv);
    logLiveConsole('Drawing mode enabled - Select tap region', 'info');
}

function disableDrawingMode() {
    const activeBlock = document.querySelector('.active-block');
    if (activeBlock) {
        activeBlock.classList.remove('active-block');
    }
    currentTapBlock = null;

    // Also clear focus when disabling drawing mode
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock = null;
    }

    // Re-enable all Add Tap buttons
    document.querySelectorAll('.add-tap-btn').forEach(btn => {
        btn.disabled = false;
    });
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

function addTapBlock(parent, blockData = null) {
    const tapBlock = blockData || {
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

function addLoopBlock(parent, blockData = null) {
    const loopBlock = blockData || {
        type: 'loop',
        iterations: 1,
        blocks: [],
        name: 'Loop Block'
    };
    parent.blocks.push(loopBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block loop-block';
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name" contenteditable="true">${loopBlock.name}</h6>
        </div>
        <div class="input-group mb-2">
            <span class="input-group-text">Iterations</span>
            <input type="number" class="form-control iterations-input" value="1" min="1">
        </div>
        <div class="nested-blocks"></div>
        <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
            <button class="btn btn-sm btn-outline-info add-print-btn">Add Print</button>
        </div>
    `;

    const iterationsInput = blockDiv.querySelector('.iterations-input');
    iterationsInput.value = parent.iterations || 1;
    iterationsInput.addEventListener('change', (e) => {
        loopBlock.iterations = parseInt(e.target.value) || 1;
        saveTasksToStorage();
    });

    blockDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(loopBlock);
        blockDiv.querySelector('.nested-blocks').appendChild(tapDiv);
        saveTasksToStorage();
    });

    return blockDiv;
}


function generateGCode() {
    if (!currentTask) {
        logLiveConsole("No task selected", "error");
        return;
    }

    let gcode = `; G-code for Samsung Galaxy A11\n`;
    gcode += `; Physical dimensions: ${PHYSICAL_WIDTH}mm x ${PHYSICAL_HEIGHT}mm\n`;
    gcode += `; Screen dimensions: ${DEVICE_WIDTH}px x ${DEVICE_HEIGHT}px\n\n`;
    gcode += `G21 ; Set units to millimeters\n`;
    gcode += `G90 ; Use absolute coordinates\n\n`;

    function convertToPhysical(pixelX, pixelY) {
        // Convert pixel coordinates to physical coordinates (mm)
        const physicalX = (pixelX / DEVICE_WIDTH) * PHYSICAL_WIDTH;
        const physicalY = (pixelY / DEVICE_HEIGHT) * PHYSICAL_HEIGHT;
        return {
            x: Math.max(0, Math.min(PHYSICAL_WIDTH, physicalX)),  // Clamp to physical boundaries
            y: Math.max(0, Math.min(PHYSICAL_HEIGHT, physicalY))
        };
    }

    function processBlocks(blocks, indent = 0) {
        let code = '';
        const indentation = '  '.repeat(indent);

        blocks.forEach(block => {
            if (block.type === 'tap' && block.region) {
                // Calculate center point of the tap region
                const center = {
                    x: (block.region.x1 + block.region.x2) / 2,
                    y: (block.region.y1 + block.region.y2) / 2
                };
                const physical = convertToPhysical(center.x, center.y);

                code += `${indentation}; Tap at pixel coordinates (${Math.round(center.x)}, ${Math.round(center.y)})\n`;
                code += `${indentation}G1 X${physical.x.toFixed(2)} Y${physical.y.toFixed(2)} F1000 ; Move to tap position\n`;
                code += `${indentation}G1 Z0 F500 ; Tap down\n`;
                code += `${indentation}G4 P100 ; Wait 100ms\n`;
                code += `${indentation}G1 Z5 F500 ; Tap up\n`;
                code += `${indentation}G4 P200 ; Wait 200ms between taps\n\n`;
            } else if (block.type === 'loop') {
                code += `${indentation}; Start loop (${block.iterations} iterations)\n`;
                for (let i = 0; i < block.iterations; i++) {
                    code += `${indentation}; Iteration ${i + 1}\n`;
                    code += processBlocks(block.blocks, indent + 1);
                }
                code += `${indentation}; End loop\n\n`;
            }
        });
        return code;
    }

    gcode += processBlocks(currentTask.blocks);
    logLiveConsole("G-code generated successfully", "success");
    return gcode;
}

// Placeholder functions -  These need actual implementations
function setupDragAndDrop(blockDiv) {}
function simulateTap(x, y) {}

function handleMessage(message) {
    if (!message || !message.command) return;

    switch (message.command) {
        case 'create_task_with_blocks':
            // Create new task with proper initialization
            const task = {
                id: `task-${Date.now()}`,
                name: message.params.taskName || 'New Task',
                blocks: [],
                minimized: false,
                created: new Date().toISOString()
            };

            // Add the task to tasks array and select it
            tasks.push(task);
            currentTask = task;

            // Load the task UI and update the task list
            loadTask(task);
            saveTasksToStorage();
            updateTaskList();

            // Add blocks if provided
            if (message.params.blocks && Array.isArray(message.params.blocks)) {
                message.params.blocks.forEach(blockData => {
                    if (blockData.type === 'tap') {
                        const tapBlock = {
                            type: 'tap',
                            region: null,
                            name: blockData.name || 'Tap Block'
                        };
                        task.blocks.push(tapBlock);
                    }
                });
            }
            break;
        case 'load_task':
            const taskToLoad = tasks.find(t => t.name.toLowerCase() === message.params.taskName.toLowerCase());
            if (taskToLoad) {
                loadTask(taskToLoad);
                logLiveConsole(`Loaded task: ${taskToLoad.name}`, 'success');
            } else {
                logLiveConsole(`Task '${message.params.taskName}' not found`, 'error');
            }
            break;
        case 'execute':
            if (currentTask) {
                executeSelectedTask();
            } else {
                logLiveConsole('No task selected to execute', 'error');
            }
            break;
    }
}