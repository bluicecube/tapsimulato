// Initialize state
const state = {
    tasks: [],
    deletedTasks: [],
    currentTask: null,
    chatHistory: []
};

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create and manage tap sequences.
Your responses should be in JSON format:
{
    "command": "create_task|add_corner_taps|execute|chat",
    "params": {
        "taskName": "string",  // for create_task
        "iterations": "number" // for add_corner_taps
    },
    "message": "human readable response"
}`;

// Chat UI functions
function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.innerHTML = `
        ${content}
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add to history
    state.chatHistory.push({ role, content });
}

function showThinking() {
    const chatMessages = document.getElementById('chatMessages');
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'chat-thinking';
    thinkingDiv.id = 'thinkingIndicator';
    thinkingDiv.innerHTML = `
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
    `;
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideThinking() {
    const thinkingDiv = document.getElementById('thinkingIndicator');
    if (thinkingDiv) {
        thinkingDiv.remove();
    }
}

// Task management functions
function createNewTask(taskName = 'New Task') {
    const task = {
        id: `task-${Date.now()}`,
        name: taskName,
        blocks: [],
        created: new Date().toISOString()
    };
    state.tasks.push(task);
    state.currentTask = task;

    updateTaskDisplay();
    saveState();
    return task;
}

function updateTaskDisplay() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    taskList.innerHTML = '';
    state.tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-list-item';
        if (state.currentTask?.id === task.id) {
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

        taskItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-task-btn')) {
                loadTask(task);
            }
        });

        taskItem.querySelector('.delete-task-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task);
        });

        taskList.appendChild(taskItem);
    });
}

// State management
function saveState() {
    localStorage.setItem('appState', JSON.stringify({
        tasks: state.tasks,
        deletedTasks: state.deletedTasks,
        currentTask: state.currentTask
    }));
}

function loadState() {
    const savedState = localStorage.getItem('appState');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        state.tasks = parsed.tasks || [];
        state.deletedTasks = parsed.deletedTasks || [];
        state.currentTask = parsed.currentTask;
    }
}

// Message handling
async function handleMessage(event) {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Clear input
    chatInput.value = '';

    // Add user message
    addMessage('user', message);

    // Show thinking indicator
    showThinking();

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        // Add recent chat history
        state.chatHistory.slice(-4).forEach(msg => messages.push(msg));

        // Add current message
        messages.push({ role: 'user', content: message });

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        const data = await response.json();
        hideThinking();

        if (data.error) throw new Error(data.error);

        const assistantMessage = data.choices[0].message.content;
        let responseData;

        try {
            responseData = JSON.parse(assistantMessage);
        } catch (e) {
            responseData = {
                command: 'chat',
                params: {},
                message: assistantMessage
            };
        }

        // Add assistant's message to chat
        addMessage('assistant', responseData.message);

        // Process any commands
        if (responseData.command !== 'chat') {
            await processCommand(responseData);
        }

    } catch (error) {
        console.error('Error:', error);
        hideThinking();
        addMessage('assistant', 'Sorry, something went wrong. Please try again.');
    }
}

// Command processing
async function processCommand(response_data) {
    const { command, params } = response_data;

    try {
        switch (command) {
            case 'create_task':
                const task = createNewTask(params.taskName || 'New Task');
                updateTaskDisplay();
                break;

            case 'add_corner_taps':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }
                await addCornerTapsToTask(state.currentTask, params.iterations || 1);
                break;

            case 'execute':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please select a task to execute.');
                    return;
                }
                executeTask(state.currentTask);
                break;
            default:
                console.log("Unknown command:", command);
        }
    } catch (error) {
        console.error('Error in processCommand:', error);
        addMessage('assistant', `Error: ${error.message}`);
    }
}

async function addCornerTapsToTask(task, iterations = 1) {
    try {
        // First, clear existing blocks
        task.blocks = [];

        // Create main loop block
        const loopBlock = {
            type: 'loop',
            iterations: iterations,
            blocks: [],
            name: 'Corner Taps'
        };
        task.blocks.push(loopBlock);

        // Define the corners
        const corners = [
            { name: 'Top Left', x1: 0, y1: 0, x2: 50, y2: 50 },
            { name: 'Top Right', x1: 270, y1: 0, x2: 320, y2: 50 },
            { name: 'Bottom Left', x1: 0, y1: 670, x2: 50, y2: 720 },
            { name: 'Bottom Right', x1: 270, y1: 670, x2: 320, y2: 720 }
        ];

        // Add tap blocks for each corner
        corners.forEach(corner => {
            const tapBlock = {
                type: 'tap',
                region: {
                    x1: corner.x1,
                    y1: corner.y1,
                    x2: corner.x2,
                    y2: corner.y2
                },
                name: `Tap ${corner.name}`
            };
            loopBlock.blocks.push(tapBlock);
        });

        // Update the display
        const currentTaskElement = document.getElementById('currentTask');
        if (currentTaskElement) {
            currentTaskElement.innerHTML = '';
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'blocks-container';

            // Create and append the loop block UI
            const loopDiv = createLoopBlockUI(loopBlock);
            blocksContainer.appendChild(loopDiv);
            currentTaskElement.appendChild(blocksContainer);
        }

        // Save state
        saveState();
        updateTaskDisplay();

    } catch (error) {
        console.error('Error in addCornerTapsToTask:', error);
        addMessage('assistant', `Error: ${error.message}`);
    }
}

function createLoopBlockUI(loopBlock) {
    const blockDiv = document.createElement('div');
    blockDiv.className = 'block loop-block';
    blockDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name">${loopBlock.name}</h6>
            <span class="badge bg-secondary">${loopBlock.iterations}x</span>
        </div>
        <div class="nested-blocks">
            ${loopBlock.blocks.map(block => createTapBlockUI(block)).join('')}
        </div>
    `;
    return blockDiv;
}

function createTapBlockUI(tapBlock) {
    return `
        <div class="block tap-block">
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="block-name">${tapBlock.name}</h6>
            </div>
        </div>
    `;
}


function executeTask(task) {
    if (!task || !task.blocks || task.blocks.length === 0) {
        addMessage('assistant', 'This task has no blocks to execute.');
        return;
    }

    // Execute each block in sequence
    task.blocks.forEach(block => {
        if (block.type === 'loop') {
            for (let i = 0; i < block.iterations; i++) {
                block.blocks.forEach(tapBlock => {
                    if (tapBlock.type === 'tap' && tapBlock.region) {
                        const { x1, y1, x2, y2 } = tapBlock.region;
                        const x = x1 + (x2 - x1) / 2;
                        const y = y1 + (y2 - y1) / 2;
                        simulateTap(x, y);
                    }
                });
            }
        }
    });

    addMessage('assistant', 'Task executed successfully.');
}

// Function to simulate a tap at given coordinates
function simulateTap(x, y) {
    // Create a visual feedback element
    const tapFeedback = document.createElement('div');
    tapFeedback.className = 'tap-feedback';
    tapFeedback.style.left = `${x}px`;
    tapFeedback.style.top = `${y}px`;

    // Add to simulator
    const simulator = document.getElementById('simulator');
    if (simulator) {
        simulator.appendChild(tapFeedback);

        // Remove after animation
        setTimeout(() => tapFeedback.remove(), 500);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load saved state
    loadState();
    updateTaskDisplay();

    // Setup message handlers
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');

    if (chatInput && sendButton) {
        sendButton.addEventListener('click', handleMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMessage(e);
        });
    }

    // Show initial greeting
    addMessage('assistant', 'Hi! I can help you create tap sequences. Would you like to create a new task?');
});

// Export necessary functions
window.addMessage = addMessage;
window.handleMessage = handleMessage;
window.createNewTask = createNewTask;
window.processCommand = processCommand;

function addLoopBlock(parent, iterations = 1) {
    const loopBlock = {
        type: 'loop',
        iterations: iterations,
        blocks: [],
        name: 'Loop Block'
    };
    parent.blocks.push(loopBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block loop-block';
    blockDiv.draggable = true;
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name" contenteditable="true">${loopBlock.name}</h6>
        </div>
        <div class="input-group mb-2">
            <span class="input-group-text">Iterations</span>
            <input type="number" class="form-control iterations-input" value="${iterations}" min="1">
        </div>
        <div class="nested-blocks"></div>
        <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
            <button class="btn btn-sm btn-outline-info add-print-btn">Add Print</button>
        </div>
    `;

    setupDragAndDrop(blockDiv);

    const iterationsInput = blockDiv.querySelector('.iterations-input');
    iterationsInput.value = iterations;
    iterationsInput.addEventListener('change', (e) => {
        loopBlock.iterations = parseInt(e.target.value) || 1;
        saveState();
    });

    blockDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(loopBlock);
        blockDiv.querySelector('.nested-blocks').appendChild(tapDiv);
        saveState();
    });

    return blockDiv;
}

function setupDragAndDrop(blockDiv) {
    blockDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', '');
        blockDiv.classList.add('dragging');
    });

    blockDiv.addEventListener('dragend', () => {
        blockDiv.classList.remove('dragging');
    });

    blockDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingBlock = document.querySelector('.dragging');
        if (!draggingBlock) return;

        const nestedBlocks = blockDiv.querySelector('.nested-blocks');
        if (nestedBlocks && blockDiv.classList.contains('loop-block')) {
            const afterElement = getDragAfterElement(nestedBlocks, e.clientY);
            if (afterElement) {
                nestedBlocks.insertBefore(draggingBlock, afterElement);
            } else {
                nestedBlocks.appendChild(draggingBlock);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.block:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getRegionForLocation(location) {
    const screen = {
        width: 320,  // Device width from CSS
        height: 720  // Device height from CSS
    };

    // Define regions based on screen dimensions
    const regions = {
        'top-left': {
            x1: 0,
            y1: 0,
            x2: screen.width / 2,
            y2: screen.height / 3
        },
        'top-right': {
            x1: screen.width / 2,
            y1: 0,
            x2: screen.width,
            y2: screen.height / 3
        },
        'bottom-left': {
            x1: 0,
            y1: 2 * screen.height / 3,
            x2: screen.width / 2,
            y2: screen.height
        },
        'bottom-right': {
            x1: screen.width / 2,
            y1: 2 * screen.height / 3,
            x2: screen.width,
            y2: screen.height
        },
        'middle': {
            x1: screen.width / 4,
            y1: screen.height / 3,
            x2: 3 * screen.width / 4,
            y2: 2 * screen.height / 3
        },
        'top': {
            x1: screen.width / 4,
            y1: 0,
            x2: 3 * screen.width / 4,
            y2: screen.height / 3
        },
        'bottom': {
            x1: screen.width / 4,
            y1: 2 * screen.height / 3,
            x2: 3 * screen.width / 4,
            y2: screen.height
        },
        'left': {
            x1: 0,
            y1: screen.height / 3,
            x2: screen.width / 3,
            y2: 2 * screen.height / 3
        },
        'right': {
            x1: 2 * screen.width / 3,
            y1: screen.height / 3,
            x2: screen.width,
            y2: 2 * screen.height / 3
        }
    };

    // Normalize location input
    const normalized = location.toLowerCase().replace(/\s+/g, '-');

    // Map various natural language inputs to region keys
    const locationMap = {
        'upper-left': 'top-left',
        'upper-right': 'top-right',
        'lower-left': 'bottom-left',
        'lower-right': 'bottom-right',
        'center': 'middle',
        'centre': 'middle',
        'top-center': 'top',
        'bottom-center': 'bottom',
        'left-center': 'left',
        'right-center': 'right'
    };

    const regionKey = locationMap[normalized] || normalized;
    return regions[regionKey] || regions['middle'];
}

function addTapBlock(parent) {
    //This function is not fully defined in the original code.  Leaving as is.
}

function deleteTask(task) {
    const index = state.tasks.indexOf(task);
    if (index > -1) {
        state.deletedTasks.push(state.tasks.splice(index, 1)[0]);
    }
    saveState();
    updateTaskDisplay();
}

function loadTask(taskToLoad){
    //This function is not fully defined in the original code.  Leaving as is.
}

function showSelectionBox(tapBlock){
    //This function is not fully defined in the original code.  Leaving as is.
}