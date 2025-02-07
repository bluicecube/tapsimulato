// Initialize state
const state = {
    task: {
        name: 'Current Task',
        blocks: []
    }
};

// Update the system prompt to reflect single task functionality
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create sequences using only two types of blocks:

1. Tap Block: Defines a single tap action in a specific region of the screen
2. Loop Block: Repeats its nested blocks a specified number of times

Interpret natural language to create these sequences.
Examples:
- "tap in each corner" → Add corner tap blocks
- "tap bottom 5 times" → Add loop with bottom taps
- "tap the screen 3 times" → Create a loop block with iterations=3 containing a tap block
- "tap top of screen" → Create a tap block with region set to the top portion

Your responses should be in JSON format:
{
    "command": "add_blocks|execute|chat",
    "params": {
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

    // Show initial greeting
    setTimeout(() => {
        addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. What would you like to do?');
    }, 500);
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeChat();
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
            { role: 'system', content: SYSTEM_PROMPT },
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

// Update task display
function updateTaskDisplay() {
    const currentTaskElement = document.getElementById('currentTask');
    if (!currentTaskElement) return;

    currentTaskElement.innerHTML = `
        <div class="task-block">
            <div class="blocks-container"></div>
        </div>
    `;

    // Render blocks
    const blocksContainer = currentTaskElement.querySelector('.blocks-container');
    if (blocksContainer) {
        state.task.blocks.forEach(block => {
            blocksContainer.appendChild(renderBlock(block));
        });
    }
}

// Process commands from the chatbot
async function processCommand(responseData) {
    try {
        const { command, params } = responseData;

        switch (command) {
            case 'add_blocks':
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
                            const region = calculateRegionFromDescription(def.location);
                            return {
                                type: 'tap',
                                name: 'Tap Block',
                                region: region,
                                description: def.location || 'Center of screen'
                            };
                        }
                    });
                }

                const newBlocks = createBlocks(params.blocks || []);
                state.task.blocks.push(...newBlocks);
                updateTaskDisplay();
                break;

            case 'execute':
                window.executeSelectedTask && window.executeSelectedTask();
                break;
        }
    } catch (error) {
        console.error('Error processing command:', error);
        addMessage('assistant', 'Error processing command. Please try again.');
    }
}

// Helper function to calculate region from description
function calculateRegionFromDescription(description) {
    const normalized = description.toLowerCase().trim();

    // Screen dimensions must match the CSS variables
    const DEVICE_WIDTH = 320;
    const DEVICE_HEIGHT = 720;

    // Define screen regions with actual coordinates
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

    // Try to match description to a region
    for (const [key, region] of Object.entries(regions)) {
        if (normalized.includes(key)) {
            return region;
        }
    }

    // Default to center if no match
    return regions.center;
}

function renderBlock(block) {
    const blockDiv = document.createElement('div');
    blockDiv.className = `block ${block.type}-block`;

    if (block.type === 'tap') {
        const regionText = block.region ?
            `(${block.region.x1},${block.region.y1}) to (${block.region.x2},${block.region.y2})` :
            'No region set';

        blockDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="block-name mb-0">Tap Block</h6>
                <button class="btn btn-sm btn-outline-primary select-region-btn">
                    ${block.region ? 'Change Region' : 'Set Region'}
                </button>
            </div>
            <small class="text-muted">Region: ${regionText}</small>
        `;

        // Add click handler to show region
        blockDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.select-region-btn')) {
                // Call the simulator's setBlockFocus function
                window.setBlockFocus && window.setBlockFocus(block, blockDiv);
            }
        });

        // Add region selection handler
        blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
            window.enableDrawingMode && window.enableDrawingMode(block, blockDiv);
        });
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

        // Set up iterations input handler
        const iterationsInput = blockDiv.querySelector('.iterations-input');
        iterationsInput.addEventListener('change', (e) => {
            block.iterations = parseInt(e.target.value) || 1;
        });

        // Render nested blocks
        const nestedContainer = blockDiv.querySelector('.nested-blocks');
        block.blocks.forEach(nestedBlock => {
            nestedContainer.appendChild(renderBlock(nestedBlock));
        });
    }

    return blockDiv;
}


// Export necessary functions for external use
window.addMessage = addMessage;
window.handleMessage = handleMessage;
window.processCommand = processCommand;

// Make the simulator's functions available to chatbot.js
window.setBlockFocus = window.setBlockFocus || function() { console.warn('setBlockFocus not loaded'); };
window.showSelectionBox = window.showSelectionBox || function() { console.warn('showSelectionBox not loaded'); };
window.enableDrawingMode = window.enableDrawingMode || function() { console.warn('enableDrawingMode not loaded'); };