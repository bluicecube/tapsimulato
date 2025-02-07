// Initialize state
const state = {
    chatHistory: [],
    tasks: [],
    currentTask: null
};

// Update the system prompt to include combined task creation and block addition
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create sequences using only two types of blocks:

1. Tap Block: Defines a single tap action in a specific region of the screen
2. Loop Block: Repeats its nested blocks a specified number of times

Interpret natural language to create these sequences. You can create a task and add blocks in a single command.
Examples:
- "create task named TapCorners with taps in each corner" → Create task and add corner tap blocks
- "create task AutoScroll with 5 bottom taps" → Create task and add loop with bottom taps
- "tap the screen 3 times" → Create a loop block with iterations=3 containing a tap block
- "tap top of screen" → Create a tap block with region set to the top portion

Your responses should be in JSON format:
{
    "command": "create_task_with_blocks|add_blocks|execute|chat",
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
        if (chatMessages && state.chatHistory.length === 0) {
            addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. Would you like to create a new task?');
        }
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

// Update the command processing to handle combined creation and block addition
async function processCommand(responseData) {
    try {
        const { command, params, message } = responseData;

        switch (command) {
            case 'create_task_with_blocks':
                const taskName = params.taskName || 'New Task';
                // Create new task with specified name
                const newTask = window.simulatorAPI.createNewTask();
                // Update task name
                newTask.name = taskName;
                // Process and add blocks
                if (params.blocks && params.blocks.length > 0) {
                    const processedBlocks = params.blocks.map(block => {
                        if (block.type === 'tap') {
                            return {
                                type: 'tap',
                                region: calculateRegionFromDescription(block.location),
                                name: block.name || 'Tap Block'
                            };
                        } else if (block.type === 'loop') {
                            return {
                                type: 'loop',
                                iterations: block.iterations || 1,
                                blocks: block.blocks.map(b => ({
                                    type: 'tap',
                                    region: calculateRegionFromDescription(b.location),
                                    name: b.name || 'Tap Block'
                                }))
                            };
                        }
                    });
                    window.simulatorAPI.addBlocksToChatbotTask(newTask, processedBlocks);
                }
                addMessage('assistant', `Created new task "${taskName}" with ${params.blocks.length} blocks`);
                break;

            case 'execute':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please select a task to execute.');
                    return;
                }
                window.simulatorAPI.executeSelectedTask();
                break;

            case 'add_blocks':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }
                // Process blocks before adding them
                const processedBlocks = params.blocks.map(block => {
                    if (block.type === 'tap') {
                        return {
                            type: 'tap',
                            region: calculateRegionFromDescription(block.location),
                            name: block.name || 'Tap Block'
                        };
                    } else if (block.type === 'loop') {
                        return {
                            type: 'loop',
                            iterations: block.iterations || 1,
                            blocks: block.blocks.map(b => ({
                                type: 'tap',
                                region: calculateRegionFromDescription(b.location),
                                name: b.name || 'Tap Block'
                            }))
                        };
                    }
                });
                window.simulatorAPI.addBlocksToChatbotTask(state.currentTask, processedBlocks);
                addMessage('assistant', `Added ${params.blocks.length} blocks to the current task`);
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

    // Screen dimensions must match the CSS variables
    const DEVICE_WIDTH = 320;
    const DEVICE_HEIGHT = 720;

    // Define screen regions with actual coordinates
    const regions = {
        'middle': {
            x1: Math.round(DEVICE_WIDTH * 0.25),
            y1: Math.round(DEVICE_HEIGHT * 0.33),  // One-third of height
            x2: Math.round(DEVICE_WIDTH * 0.75),
            y2: Math.round(DEVICE_HEIGHT * 0.67)   // Two-thirds of height
        },
        'center': {
            x1: Math.round(DEVICE_WIDTH * 0.25),
            y1: Math.round(DEVICE_HEIGHT * 0.33),  // Match with middle
            x2: Math.round(DEVICE_WIDTH * 0.75),
            y2: Math.round(DEVICE_HEIGHT * 0.67)   // Match with middle
        },
        'top': {
            x1: 0,
            y1: 0,
            x2: DEVICE_WIDTH,
            y2: Math.round(DEVICE_HEIGHT * 0.15)   // Top 15% of screen
        },
        'bottom': {
            x1: 0,
            y1: Math.round(DEVICE_HEIGHT * 0.85),  // Bottom 15% of screen
            x2: DEVICE_WIDTH,
            y2: DEVICE_HEIGHT
        },
        'left': {
            x1: 0,
            y1: Math.round(DEVICE_HEIGHT * 0.25),  // Center vertically
            x2: Math.round(DEVICE_WIDTH * 0.25),
            y2: Math.round(DEVICE_HEIGHT * 0.75)
        },
        'right': {
            x1: Math.round(DEVICE_WIDTH * 0.75),
            y1: Math.round(DEVICE_HEIGHT * 0.25),  // Center vertically
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

    // Render all blocks
    state.currentTask.blocks.forEach(block => {
        blocksContainer.appendChild(renderBlock(block));
    });
}

function executeTask(task) {
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

                    console.log(`Tapped at (${Math.round(x)}, ${Math.round(y)})`);
                }, delay);
            }
        });
    }

    executeBlocks(task.blocks);
}

// Export necessary functions for external use
window.addMessage = addMessage;
window.handleMessage = handleMessage;
window.processCommand = processCommand;
window.updateTaskBlocks = updateTaskBlocks;

// Make the simulator's functions available to chatbot.js
window.setBlockFocus = window.setBlockFocus || function() { console.warn('setBlockFocus not loaded'); };
window.showSelectionBox = window.showSelectionBox || function() { console.warn('showSelectionBox not loaded'); };
window.enableDrawingMode = window.enableDrawingMode || function() { console.warn('enableDrawingMode not loaded'); };