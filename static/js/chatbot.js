// Initialize state
const state = {
    chatHistory: [],
    tasks: [],
    currentTask: null
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

// Chat UI functions
function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat container not found');
        return;
    }

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

// Initialize chat interface
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');

    if (!chatMessages) {
        console.error('Chat container not found');
        return;
    }

    // Clear any existing messages
    chatMessages.innerHTML = '';

    if (chatInput && sendButton) {
        sendButton.addEventListener('click', handleMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMessage(e);
        });
    }

    // Show initial greeting with a slight delay to ensure DOM is ready
    setTimeout(() => {
        if (state.chatHistory.length === 0) {
            addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. Would you like to create a new task?');
        }
    }, 100);
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChat);
} else {
    initializeChat();
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
            { role: 'system', content: SYSTEM_PROMPT },
            ...state.chatHistory.slice(-4),
            { role: 'user', content: message }
        ];

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

// Task management
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
    return task;
}

function updateTaskDisplay() {
    const currentTaskElement = document.getElementById('currentTask');
    if (!currentTaskElement || !state.currentTask) return;

    currentTaskElement.innerHTML = `
        <div class="task-block">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="task-name mb-0" contenteditable="true">${state.currentTask.name}</h5>
                <div>
                    <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
                    <button class="btn btn-sm btn-outline-success add-loop-btn">Add Loop</button>
                </div>
            </div>
            <div class="blocks-container"></div>
        </div>
    `;

    // Update task list
    const taskList = document.getElementById('taskList');
    if (taskList) {
        taskList.innerHTML = state.tasks.map(task => `
            <div class="task-list-item ${state.currentTask.id === task.id ? 'active' : ''}" 
                 data-task-id="${task.id}">
                <span>${task.name}</span>
                <button class="btn btn-sm btn-outline-danger delete-task-btn">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        `).join('');
    }
}

// Command processing
async function processCommand(responseData) {
    try {
        const { command, params, message } = responseData;

        switch (command) {
            case 'create_task':
                const taskName = params.taskName || 'New Task';
                createNewTask(taskName);
                addMessage('assistant', `Created new task: ${taskName}`);
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
                                name: 'Loop Block'
                            };
                        } else if (def.type === 'tap') {
                            // Calculate region based on location description
                            const region = def.location ? calculateRegionFromDescription(def.location) : null;
                            return {
                                type: 'tap',
                                name: 'Tap Block',
                                region: region,
                                description: def.location || 'Center of screen'
                            };
                        }
                    });
                }

                // Add the new blocks to the current task
                const newBlocks = createBlocks(params.blocks || []);
                state.currentTask.blocks.push(...newBlocks);

                // Update the display
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
                console.log('Unknown command:', command);
        }
    } catch (error) {
        console.error('Error processing command:', error);
        addMessage('assistant', 'Error processing command. Please try again.');
    }
}

// Helper function to calculate region from description
function calculateRegionFromDescription(description) {
    const normalized = description.toLowerCase().trim();

    // Define screen regions
    const regions = {
        'middle': {
            x1: DEVICE_WIDTH * 0.25,
            y1: DEVICE_HEIGHT * 0.25,
            x2: DEVICE_WIDTH * 0.75,
            y2: DEVICE_HEIGHT * 0.75
        },
        'center': {
            x1: DEVICE_WIDTH * 0.25,
            y1: DEVICE_HEIGHT * 0.25,
            x2: DEVICE_WIDTH * 0.75,
            y2: DEVICE_HEIGHT * 0.75
        },
        'top': {
            x1: 0,
            y1: 0,
            x2: DEVICE_WIDTH,
            y2: DEVICE_HEIGHT * 0.25
        },
        'bottom': {
            x1: 0,
            y1: DEVICE_HEIGHT * 0.75,
            x2: DEVICE_WIDTH,
            y2: DEVICE_HEIGHT
        }
    };

    // Try to match description to a region
    for (const [key, region] of Object.entries(regions)) {
        if (normalized.includes(key)) {
            return region;
        }
    }

    // Default to center if no match
    return regions.center;
}

const DEVICE_WIDTH = 320;  // Match simulator width
const DEVICE_HEIGHT = 720; // Match simulator height

function updateTaskBlocks() {
    const currentTaskElement = document.getElementById('currentTask');
    if (!currentTaskElement || !state.currentTask) return;

    const blocksContainer = currentTaskElement.querySelector('.blocks-container');
    if (!blocksContainer) return;

    blocksContainer.innerHTML = '';

    function renderBlock(block) {
        const blockDiv = document.createElement('div');
        blockDiv.className = `block ${block.type}-block`;

        if (block.type === 'tap') {
            blockDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="block-name mb-0">Tap Block</h6>
                    <button class="btn btn-sm btn-outline-primary select-region-btn">
                        ${block.region ? 'Change Region' : 'Set Region'}
                    </button>
                </div>
                <small class="text-muted">${block.description}</small>
            `;
        } else if (block.type === 'loop') {
            blockDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="block-name mb-0">Loop Block</h6>
                    <div class="d-flex align-items-center">
                        <input type="number" class="form-control form-control-sm iterations-input" 
                            value="${block.iterations}" min="1" style="width: 70px">
                        <span class="ms-2">times</span>
                    </div>
                </div>
                <div class="nested-blocks mt-2"></div>
            `;

            // Render nested blocks
            const nestedContainer = blockDiv.querySelector('.nested-blocks');
            block.blocks.forEach(nestedBlock => {
                nestedContainer.appendChild(renderBlock(nestedBlock));
            });
        }

        return blockDiv;
    }

    // Render all blocks
    state.currentTask.blocks.forEach(block => {
        blocksContainer.appendChild(renderBlock(block));
    });
}

function executeTask(task) {
    // Implementation will be added later
    console.log('Executing task:', task);
}

// Export necessary functions for external use
window.addMessage = addMessage;
window.handleMessage = handleMessage;
window.processCommand = processCommand;