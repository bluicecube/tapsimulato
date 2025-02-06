// Initialize state
const state = {
    tasks: [],
    deletedTasks: [],
    currentTask: null,
    chatHistory: []
};

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create and manage tap sequences.
Your responses should help interpret user intent for creating tap and loop sequences. 

Your responses should be in JSON format:
{
    "command": "create_task|add_tap_sequence|execute|chat",
    "params": {
        "taskName": "string",           // for create_task
        "iterations": number,           // number of times to repeat the sequence
        "locations": [                  // array of tap locations (optional)
            {
                "description": "string", // natural language description of where to tap
                "region": {             // optional, if user specified exact coordinates
                    "x1": number,
                    "y1": number,
                    "x2": number,
                    "y2": number
                }
            }
        ]
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

            case 'add_tap_sequence':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                // Create a loop block if iterations > 1
                const iterations = params.iterations || 1;
                let targetBlocks = state.currentTask.blocks;

                if (iterations > 1) {
                    const loopBlock = {
                        type: 'loop',
                        iterations: iterations,
                        blocks: [],
                        name: 'Loop'
                    };
                    state.currentTask.blocks.push(loopBlock);
                    targetBlocks = loopBlock.blocks;
                }

                // Add tap blocks based on locations
                if (params.locations && params.locations.length > 0) {
                    params.locations.forEach(location => {
                        const tapBlock = {
                            type: 'tap',
                            name: 'Tap',
                            region: location.region || null,
                            description: location.description
                        };
                        targetBlocks.push(tapBlock);
                    });
                } else {
                    // If no locations specified, add a single tap block
                    const tapBlock = {
                        type: 'tap',
                        name: 'Tap',
                        region: null,
                        description: 'Tap location to be defined'
                    };
                    targetBlocks.push(tapBlock);
                }

                updateTaskBlocks();
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

function updateTaskBlocks() {
    const currentTaskElement = document.getElementById('currentTask');
    if (!currentTaskElement || !state.currentTask) return;

    currentTaskElement.innerHTML = '';
    const blocksContainer = document.createElement('div');
    blocksContainer.className = 'blocks-container';

    function renderBlocks(blocks, container) {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                const loopDiv = document.createElement('div');
                loopDiv.className = 'block loop-block';
                loopDiv.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="block-name">${block.name}</h6>
                        <span class="badge bg-secondary">${block.iterations}x</span>
                    </div>
                    <div class="nested-blocks"></div>
                `;
                container.appendChild(loopDiv);
                renderBlocks(block.blocks, loopDiv.querySelector('.nested-blocks'));
            } else if (block.type === 'tap') {
                const tapDiv = document.createElement('div');
                tapDiv.className = `block tap-block${!block.region ? ' undefined-region' : ''}`;
                tapDiv.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="block-name">
                            ${block.name}
                            ${!block.region ? '<span class="blink-warning">⚠</span>' : ''}
                        </h6>
                        <button class="btn btn-sm btn-outline-primary select-region-btn">
                            ${block.region ? 'Change Region' : 'Set Region'}
                        </button>
                    </div>
                    ${block.description ? `<small class="text-muted">${block.description}</small>` : ''}
                `;

                // Add region selection functionality
                const selectRegionBtn = tapDiv.querySelector('.select-region-btn');
                selectRegionBtn.addEventListener('click', () => {
                    enableDrawingMode(block, tapDiv);
                });

                container.appendChild(tapDiv);
            }
        });
    }

    renderBlocks(state.currentTask.blocks, blocksContainer);
    currentTaskElement.appendChild(blocksContainer);
    saveState();
}

function executeTask(task) {
    if (!task || !task.blocks || task.blocks.length === 0) {
        addMessage('assistant', 'This task has no blocks to execute.');
        return;
    }

    let hasUndefinedRegions = false;

    function checkBlocks(blocks) {
        blocks.forEach(block => {
            if (block.type === 'tap' && !block.region) {
                hasUndefinedRegions = true;
            } else if (block.type === 'loop') {
                checkBlocks(block.blocks);
            }
        });
    }

    checkBlocks(task.blocks);

    if (hasUndefinedRegions) {
        addMessage('assistant', 'Some tap regions are not defined. Please define all tap regions before executing the task.');
        return;
    }

    // Execute each block in sequence
    function executeBlocks(blocks) {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                const { x1, y1, x2, y2 } = block.region;
                const x = x1 + (x2 - x1) / 2;
                const y = y1 + (y2 - y1) / 2;
                simulateTap(x, y);
            }
        });
    }

    executeBlocks(task.blocks);
    addMessage('assistant', 'Task executed successfully.');
}

function simulateTap(x, y) {
    const tapFeedback = document.createElement('div');
    tapFeedback.className = 'tap-feedback';
    tapFeedback.style.left = `${x}px`;
    tapFeedback.style.top = `${y}px`;

    const simulator = document.getElementById('simulator');
    if (simulator) {
        simulator.appendChild(tapFeedback);
        setTimeout(() => tapFeedback.remove(), 500);
    }
}

// Placeholder for region selection (needs implementation)
function enableDrawingMode(block, tapDiv) {
    // Implement region selection logic here using a drawing library or similar
    // Update block.region with the selected region coordinates
    // Update the UI to reflect the change
    console.log("Region selection needs implementation", block, tapDiv);
    alert("Region selection is not yet implemented.  Please manually specify coordinates in your commands.");
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateTaskDisplay();

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

//Functions below this line were in the original code and are kept as is.

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
    const tapBlock = {
        type: 'tap',
        name: 'Tap',
        region: null,
        description: 'Tap location to be defined'
    };
    parent.blocks.push(tapBlock);

    const tapDiv = document.createElement('div');
    tapDiv.className = 'block tap-block undefined-region';
    tapDiv.draggable = true;
    tapDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center">
            <h6 class="block-name">Tap<span class="blink-warning">⚠</span></h6>
            <button class="btn btn-sm btn-outline-primary select-region-btn">Set Region</button>
        </div>
        <small class="text-muted">Tap location to be defined</small>
    `;

    const selectRegionBtn = tapDiv.querySelector('.select-region-btn');
    selectRegionBtn.addEventListener('click', () => {
        enableDrawingMode(tapBlock, tapDiv);
    });
    setupDragAndDrop(tapDiv);

    return tapDiv;
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
    state.currentTask = taskToLoad;
    updateTaskBlocks();
}

function showSelectionBox(tapBlock){
    //This function is not fully defined in the original code.  Leaving as is.
}