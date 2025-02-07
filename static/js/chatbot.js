// System prompt for task automation
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create sequences using only two types of blocks:

1. Tap Block: Defines a single tap action in a specific region of the screen
2. Loop Block: Repeats its nested blocks a specified number of times

Your responses should be in JSON format:
{
    "command": "add_blocks|execute|chat",
    "params": {
        "blocks": [
            {
                "type": "loop",
                "iterations": number,
                "blocks": []
            },
            {
                "type": "tap",
                "location": "string"
            }
        ]
    },
    "message": "human readable response"
}`;

// Add message to chat interface
function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}`;
    messageEl.textContent = content;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Calculate tap region based on description
function calculateTapRegion(description) {
    const DEVICE_WIDTH = 320;
    const DEVICE_HEIGHT = 720;

    const locations = {
        'top': {
            x1: 0,
            y1: 0,
            x2: DEVICE_WIDTH,
            y2: Math.round(DEVICE_HEIGHT * 0.2)
        },
        'bottom': {
            x1: 0,
            y1: Math.round(DEVICE_HEIGHT * 0.8),
            x2: DEVICE_WIDTH,
            y2: DEVICE_HEIGHT
        },
        'middle': {
            x1: Math.round(DEVICE_WIDTH * 0.25),
            y1: Math.round(DEVICE_HEIGHT * 0.4),
            x2: Math.round(DEVICE_WIDTH * 0.75),
            y2: Math.round(DEVICE_HEIGHT * 0.6)
        },
        'left': {
            x1: 0,
            y1: Math.round(DEVICE_HEIGHT * 0.25),
            x2: Math.round(DEVICE_WIDTH * 0.25),
            y2: Math.round(DEVICE_HEIGHT * 0.75)
        },
        'right': {
            x1: Math.round(DEVICE_WIDTH * 0.75),
            y1: Math.round(DEVICE_HEIGHT * 0.25),
            x2: DEVICE_WIDTH,
            y2: Math.round(DEVICE_HEIGHT * 0.75)
        }
    };

    const desc = description.toLowerCase();
    for (const [key, region] of Object.entries(locations)) {
        if (desc.includes(key)) {
            return region;
        }
    }

    return locations.middle;
}

// Process blocks from AI response
function processBlocks(blocks) {

    const newBlocks = blocks.map(block => {
        if (block.type === 'loop') {
            return {
                type: 'loop',
                name: 'Loop Block',
                iterations: block.iterations || 1,
                blocks: block.blocks || []
            };
        } else if (block.type === 'tap') {
            const region = calculateTapRegion(block.location);
            return {
                type: 'tap',
                name: 'Tap Block',
                region: region,
                description: block.location || 'Center tap'
            };
        }
        return null;
    }).filter(block => block !== null);

    if (window.state && window.state.currentTask) {
        window.state.currentTask.blocks.push(...newBlocks);
        if (typeof window.updateTaskDisplay === 'function') {
            window.updateTaskDisplay();
        }
        if (typeof window.scheduleAutosave === 'function') {
            window.scheduleAutosave();
        }
    } else {
        console.error('No active task to add blocks to');
    }
}

// Basic chat functionality
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');

    // Function to add a message to the chat
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add initial greeting
    addMessage("Hello! How can I help you today?");

    // Function to send message
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Clear input and add user message
        chatInput.value = '';
        addMessage(message, true);

        // Add loading message
        const loadingId = 'loading-' + Date.now();
        addMessage('Thinking...', false);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a touchscreen task automation assistant. Help users create sequences using tap and loop blocks.'
                        },
                        { role: 'user', content: message }
                    ]
                })
            });

            const data = await response.json();

            // Remove last message (loading indicator)
            chatMessages.removeChild(chatMessages.lastChild);

            if (data.error) {
                addMessage('Sorry, there was an error. Please try again.');
                return;
            }

            const aiResponse = data.choices[0].message.content;
            addMessage(aiResponse);

        } catch (error) {
            console.error('Chat error:', error);
            // Remove last message (loading indicator)
            chatMessages.removeChild(chatMessages.lastChild);
            addMessage('Sorry, I encountered an error. Please try again.');
        }
    }

    // Attach event listeners
    if (sendButton) {
        sendButton.onclick = sendMessage;
    }

    if (chatInput) {
        chatInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        };
    }
});

// Make add message available to other modules
window.addMessage = addMessage;
window.processBlocks = processBlocks;

// Make the simulator's functions available to chatbot.js
window.setBlockFocus = window.setBlockFocus || function() { console.warn('setBlockFocus not loaded'); };
window.showSelectionBox = window.showSelectionBox || function() { console.warn('showSelectionBox not loaded'); };
window.enableDrawingMode = window.enableDrawingMode || function() { console.warn('enableDrawingMode not loaded'); };
const AUTOSAVE_DELAY = 2000; 
const state = {
    tasks: [],
    currentTask: null,
    autoSaveTimeout: null
};

// Task Management Functions
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
        logLiveConsole('Error loading tasks', 'error');
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

        logLiveConsole('New task created', 'success');
    } catch (error) {
        console.error('Error creating task:', error);
        logLiveConsole('Error creating task', 'error');
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
        logLiveConsole(`Loaded task ${taskId}`, 'success');
    } catch (error) {
        console.error('Error loading task:', error);
        logLiveConsole('Error loading task blocks', 'error');
    }
}

function updateTaskSelect() {
    const select = document.getElementById('taskSelect');
    select.innerHTML = '<option value="">Select a task...</option>' +
        state.tasks.map(task =>
            `<option value="${task.id}">${task.name}</option>`
        ).join('');
}

// Autosave functionality
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
                logLiveConsole('Task autosaved', 'success');
            } catch (error) {
                console.error('Autosave error:', error);
                logLiveConsole('Failed to autosave task', 'error');
            }
        }
    }, AUTOSAVE_DELAY);
}

function logLiveConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    if (!console) return;

    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageEl);
    console.scrollTop = console.scrollHeight;
}


function calculateRegionFromDescription(description) {
    const normalized = description.toLowerCase().trim();

    const regions = {
        'middle': {
            x1: Math.round(DEVICE_WIDTH * 0.25),
            y1: Math.round(DEVICE_HEIGHT * 0.33),
            x2: Math.round(DEVICE_WIDTH * 0.75),
            y2: Math.round(DEVICE_HEIGHT * 0.67)
        },
        'center': {
            x1: Math.round(DEVICE_WIDTH * 0.25),
            y1: Math.round(DEVICE_HEIGHT * 0.33),
            x2: Math.round(DEVICE_WIDTH * 0.75),
            y2: Math.round(DEVICE_HEIGHT * 0.67)
        },
        'top': {
            x1: 0,
            y1: 0,
            x2: DEVICE_WIDTH,
            y2: Math.round(DEVICE_HEIGHT * 0.15)
        },
        'bottom': {
            x1: 0,
            y1: Math.round(DEVICE_HEIGHT * 0.85),
            x2: DEVICE_WIDTH,
            y2: DEVICE_HEIGHT
        },
        'left': {
            x1: 0,
            y1: Math.round(DEVICE_HEIGHT * 0.25),
            x2: Math.round(DEVICE_WIDTH * 0.25),
            y2: Math.round(DEVICE_HEIGHT * 0.75)
        },
        'right': {
            x1: Math.round(DEVICE_WIDTH * 0.75),
            y1: Math.round(DEVICE_HEIGHT * 0.25),
            x2: DEVICE_WIDTH,
            y2: Math.round(DEVICE_HEIGHT * 0.75)
        }
    };

    for (const [key, region] of Object.entries(regions)) {
        if (normalized.includes(key)) {
            return region;
        }
    }

    return regions.center;
}

function updateTaskDisplay() {
    const currentTaskElement = document.getElementById('currentTask');
    if (!currentTaskElement) return;

    currentTaskElement.innerHTML = '';

    function renderBlock(block) {
        const blockDiv = document.createElement('div');
        blockDiv.className = `block ${block.type}-block`;

        if (block.type === 'tap') {
            const regionText = block.region ?
                `(${Math.round(block.region.x1)},${Math.round(block.region.y1)}) to (${Math.round(block.region.x2)},${Math.round(block.region.y2)})` :
                'No region set';

            blockDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Tap Block</h6>
                    <button class="btn btn-sm btn-outline-primary select-region-btn">
                        ${block.region ? 'Change Region' : 'Set Region'}
                    </button>
                </div>
                <small class="text-muted">Region: ${regionText}</small>
            `;

            blockDiv.addEventListener('click', (e) => {
                if (!e.target.closest('.select-region-btn')) {
                    window.setBlockFocus(block, blockDiv);
                }
            });

            blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
                window.enableDrawingMode(block, blockDiv);
            });
        } else if (block.type === 'loop') {
            blockDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Loop Block</h6>
                    <div class="d-flex align-items-center">
                        <input type="number" class="form-control form-control-sm iterations-input"
                            value="${block.iterations}" min="1" style="width: 70px">
                        <span class="ms-2">times</span>
                    </div>
                </div>
                <div class="nested-blocks mt-2"></div>
            `;

            const iterationsInput = blockDiv.querySelector('.iterations-input');
            iterationsInput.addEventListener('change', (e) => {
                block.iterations = parseInt(e.target.value) || 1;
                scheduleAutosave();
            });

            const nestedContainer = blockDiv.querySelector('.nested-blocks');
            block.blocks.forEach(nestedBlock => {
                nestedContainer.appendChild(renderBlock(nestedBlock));
            });
        }

        return blockDiv;
    }

    if (state.currentTask && state.currentTask.blocks) {
        state.currentTask.blocks.forEach(block => {
            currentTaskElement.appendChild(renderBlock(block));
        });
    }
}

// Log messages to the console
function logToConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    if (!console) return;

    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageEl);
    console.scrollTop = console.scrollHeight;
}

//Initialise tasks on load
document.addEventListener('DOMContentLoaded', loadTasks);