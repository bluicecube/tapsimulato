// Initialize state
const state = {
    tasks: [],
    deletedTasks: [],
    currentTask: null,
    chatHistory: []
};

// Device dimensions from CSS variables
const DEVICE = {
    width: 320,
    height: 720
};

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create sequences using only two types of blocks:

1. Tap Block: Defines a single tap action in a specific region of the screen
2. Loop Block: Repeats its nested blocks a specified number of times

Interpret natural language to create these sequences. For example:
- "tap the screen 3 times" → Create a loop block with iterations=3 containing a tap block
- "tap top of screen" → Create a tap block with region set to the top portion
- "tap each corner twice" → Create a loop with iterations=2 containing tap blocks for corners

Your responses should be in JSON format:
{
    "command": "create_task|add_blocks|execute|chat",
    "params": {
        "taskName": "string",           // for create_task
        "blocks": [                     // array of block definitions
            {
                "type": "loop",
                "iterations": number,
                "blocks": []            // nested blocks
            },
            {
                "type": "tap",
                "location": "string"    // natural language location description
            }
        ]
    },
    "message": "human readable response"
}`;

// Functions to convert natural language positions to screen regions
function calculateRegionFromDescription(description) {
    let normalized = description.toLowerCase().trim();

    // Screen divisions (quarters)
    const regions = {
        'top': {
            x1: 0,
            y1: 0,
            x2: DEVICE.width,
            y2: DEVICE.height * 0.25
        },
        'bottom': {
            x1: 0,
            y1: DEVICE.height * 0.75,
            x2: DEVICE.width,
            y2: DEVICE.height
        },
        'left': {
            x1: 0,
            y1: 0,
            x2: DEVICE.width * 0.25,
            y2: DEVICE.height
        },
        'right': {
            x1: DEVICE.width * 0.75,
            y1: 0,
            x2: DEVICE.width,
            y2: DEVICE.height
        },
        'center': {
            x1: DEVICE.width * 0.25,
            y1: DEVICE.height * 0.25,
            x2: DEVICE.width * 0.75,
            y2: DEVICE.height * 0.75
        },
        'middle': {
            x1: DEVICE.width * 0.25,
            y1: DEVICE.height * 0.25,
            x2: DEVICE.width * 0.75,
            y2: DEVICE.height * 0.75
        },
        'top-left': {
            x1: 0,
            y1: 0,
            x2: DEVICE.width * 0.25,
            y2: DEVICE.height * 0.25
        },
        'top-right': {
            x1: DEVICE.width * 0.75,
            y1: 0,
            x2: DEVICE.width,
            y2: DEVICE.height * 0.25
        },
        'bottom-left': {
            x1: 0,
            y1: DEVICE.height * 0.75,
            x2: DEVICE.width * 0.25,
            y2: DEVICE.height
        },
        'bottom-right': {
            x1: DEVICE.width * 0.75,
            y1: DEVICE.height * 0.75,
            x2: DEVICE.width,
            y2: DEVICE.height
        }
    };

    // Try to match the description to a region
    for (const [key, value] of Object.entries(regions)) {
        if (normalized.includes(key)) {
            return regions[key];
        }
    }

    // Default to center if no match
    return regions['center'];
}

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

// Command processing
async function processCommand(response_data) {
    const { command, params } = response_data;

    try {
        switch (command) {
            case 'create_task':
                const task = createNewTask(params.taskName || 'New Task');
                updateTaskDisplay();
                break;

            case 'add_blocks':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                // Process the block definitions recursively
                function createBlocks(blockDefs) {
                    return blockDefs.map(def => {
                        if (def.type === 'loop') {
                            return {
                                type: 'loop',
                                iterations: def.iterations || 1,
                                blocks: createBlocks(def.blocks || []),
                                name: 'Loop'
                            };
                        } else if (def.type === 'tap') {
                            // Directly calculate region from location description
                            const region = def.location ? calculateRegionFromDescription(def.location) : null;
                            return {
                                type: 'tap',
                                name: 'Tap',
                                region: region,
                                description: def.location || 'Tap location to be defined'
                            };
                        }
                    });
                }

                // Add the new blocks to the current task
                const newBlocks = createBlocks(params.blocks || []);
                state.currentTask.blocks.push(...newBlocks);
                updateTaskBlocks();

                // Show visual feedback for added blocks
                if (newBlocks.length > 0) {
                    newBlocks.forEach(block => {
                        if (block.type === 'tap' && block.region) {
                            // Create a temporary visual feedback
                            const feedback = document.createElement('div');
                            feedback.className = 'tap-feedback';
                            const x = block.region.x1 + (block.region.x2 - block.region.x1) / 2;
                            const y = block.region.y1 + (block.region.y2 - block.region.y1) / 2;
                            feedback.style.left = `${x}px`;
                            feedback.style.top = `${y}px`;

                            const simulator = document.getElementById('simulator');
                            if (simulator) {
                                simulator.appendChild(feedback);
                                setTimeout(() => feedback.remove(), 500);
                            }
                        }
                    });
                }
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

// Task display and update functions
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
                loopDiv.draggable = true;
                loopDiv.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="block-name">Loop</h6>
                        <div class="d-flex align-items-center">
                            <input type="number" class="form-control form-control-sm iterations-input" 
                                value="${block.iterations}" min="1" style="width: 70px">
                            <span class="ms-2">times</span>
                        </div>
                    </div>
                    <div class="nested-blocks"></div>
                `;

                // Setup iteration change handler
                const iterationsInput = loopDiv.querySelector('.iterations-input');
                iterationsInput.addEventListener('change', (e) => {
                    block.iterations = parseInt(e.target.value) || 1;
                    saveState();
                });

                container.appendChild(loopDiv);
                setupDragAndDrop(loopDiv);
                renderBlocks(block.blocks, loopDiv.querySelector('.nested-blocks'));
            } else if (block.type === 'tap') {
                const tapDiv = document.createElement('div');
                tapDiv.className = `block tap-block${!block.region ? ' undefined-region' : ''}`;
                tapDiv.draggable = true;
                tapDiv.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="block-name">
                            Tap
                            ${!block.region ? '<span class="blink-warning">⚠</span>' : ''}
                        </h6>
                        <button class="btn btn-sm btn-outline-primary select-region-btn">
                            ${block.region ? 'Change Region' : 'Set Region'}
                        </button>
                    </div>
                    <small class="text-muted">${block.description}</small>
                `;

                // Setup region selection
                const selectRegionBtn = tapDiv.querySelector('.select-region-btn');
                selectRegionBtn.addEventListener('click', () => {
                    enableDrawingMode(block, tapDiv);
                });

                setupDragAndDrop(tapDiv);
                tapDiv.addEventListener('click', (e) => {
                    if (!e.target.closest('.select-region-btn')) {
                        setBlockFocus(block, tapDiv);
                    }
                });

                container.appendChild(tapDiv);
            }
        });
    }

    renderBlocks(state.currentTask.blocks, blocksContainer);
    currentTaskElement.appendChild(blocksContainer);
    saveState();
}


// Region selection handling
function enableDrawingMode(block, tapDiv) {
    // Remove focus from other blocks
    document.querySelectorAll('.block').forEach(b => b.classList.remove('focused'));
    tapDiv.classList.add('focused');

    const simulator = document.getElementById('simulator');
    const selectionBox = document.getElementById('selectionBox');

    let isSelecting = false;
    let startX, startY;

    function startSelection(e) {
        isSelecting = true;
        const rect = simulator.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.classList.remove('d-none');
    }

    function updateSelection(e) {
        if (!isSelecting) return;

        const rect = simulator.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - startX;
        const height = currentY - startY;

        selectionBox.style.width = `${Math.abs(width)}px`;
        selectionBox.style.height = `${Math.abs(height)}px`;
        selectionBox.style.left = `${width < 0 ? currentX : startX}px`;
        selectionBox.style.top = `${height < 0 ? currentY : startY}px`;
    }

    function stopSelection(e) {
        if (!isSelecting) return;

        isSelecting = false;
        const rect = simulator.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        block.region = {
            x1: Math.min(startX, endX),
            y1: Math.min(startY, endY),
            x2: Math.max(startX, endX),
            y2: Math.max(startY, endY)
        };

        selectionBox.classList.add('d-none');
        tapDiv.classList.remove('undefined-region');
        updateTaskBlocks();
    }

    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Cleanup
    setTimeout(() => {
        simulator.removeEventListener('mousedown', startSelection);
        simulator.removeEventListener('mousemove', updateSelection);
        simulator.removeEventListener('mouseup', stopSelection);
    }, 0);
}

// Task execution
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

// Tap simulation
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
    addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. Would you like to create a new task?');
});

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
                document.querySelectorAll('.task-list-item').forEach(item =>
                    item.classList.remove('active'));
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

// Update the deleteTask function to properly clear blocks
function deleteTask(task) {
    const index = state.tasks.indexOf(task);
    if (index > -1) {
        state.deletedTasks.push(state.tasks.splice(index, 1)[0]);

        // Clear blocks if deleting current task
        if (state.currentTask?.id === task.id) {
            state.currentTask = state.tasks[0] || null;
            const currentTaskElement = document.getElementById('currentTask');
            if (currentTaskElement) {
                currentTaskElement.innerHTML = '';
            }
            // If there's another task, load it
            if (state.currentTask) {
                loadTask(state.currentTask);
            }
        }
    }
    saveState();
    updateTaskDisplay();
}

function loadTask(taskToLoad) {
    state.currentTask = taskToLoad;
    updateTaskBlocks();
}

// Setup drag and drop functionality
function setupDragAndDrop(element) {
    element.addEventListener('dragstart', (e) => {
        element.classList.add('dragging');
        e.dataTransfer.setData('text/plain', '');
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
    });

    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (!draggable) return;

        const container = element.closest('.blocks-container, .nested-blocks');
        if (container) {
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement) {
                container.insertBefore(draggable, afterElement);
            } else {
                container.appendChild(draggable);
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

let focusedBlock = null; // Track the currently focused block

function setBlockFocus(block, blockDiv) {
    // Remove focus from previous block if exists
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        // Also ensure we remove the active-block class
        focusedBlock.element.classList.remove('active-block');
        hideSelectionBox(focusedBlock.block);
    }

    // Hide all selection boxes
    document.querySelectorAll('.active-selection-box').forEach(box => {
        box.classList.add('d-none');
    });

    // Set focus on new block
    focusedBlock = { block, element: blockDiv };
    blockDiv.classList.add('focused');
    blockDiv.classList.add('active-block');

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
        newBox.className = 'active-selection-box d-none';
        newBox.style.border = '2px dashed blue';
        newBox.style.position = 'absolute';
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

// Export necessary functions
window.addMessage = addMessage;
window.handleMessage = handleMessage;
window.createNewTask = createNewTask;
window.processCommand = processCommand;