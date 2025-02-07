// System prompt for task automation
const SYSTEM_PROMPT = `You are a touchscreen task automation assistant. Help users create sequences using only two types of blocks:

1. Tap Block: Defines a single tap action in a specific region of the screen
2. Loop Block: Repeats its nested blocks a specified number of times

Your responses should be in JSON format:
{
    "command": "add_blocks",
    "params": {
        "blocks": [
            {
                "type": "loop",
                "iterations": 2,
                "blocks": [
                    {
                        "type": "tap",
                        "location": "top"
                    }
                ]
            },
            {
                "type": "tap",
                "location": "middle"
            }
        ]
    },
    "message": "Created sequence: tap top 2 times, then middle once"
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
    console.log('Processing blocks:', blocks);

    if (!window.state?.currentTask) {
        console.error('No active task to add blocks to');
        return [];
    }

    const processedBlocks = blocks.map(block => {
        if (block.type === 'loop') {
            return {
                type: 'loop',
                name: 'Loop Block',
                iterations: block.iterations || 1,
                blocks: block.blocks ? processBlocks(block.blocks) : []
            };
        } else if (block.type === 'tap') {
            const region = calculateTapRegion(block.location);
            return {
                type: 'tap',
                name: 'Tap Block',
                region: region,
                description: `Tap at ${block.location}`
            };
        }
        return null;
    }).filter(block => block !== null);

    if (processedBlocks.length > 0) {
        window.state.currentTask.blocks.push(...processedBlocks);
        if (typeof window.updateTaskDisplay === 'function') {
            window.updateTaskDisplay();
        }
        if (typeof window.scheduleAutosave === 'function') {
            window.scheduleAutosave();
        }
    }

    return processedBlocks;
}

// Simple chat interface implementation
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chat...');

    // Get chat elements
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');

    console.log('Chat elements:', {
        messages: chatMessages,
        input: chatInput,
        button: sendButton
    });

    if (!chatMessages || !chatInput || !sendButton) {
        console.error('Missing chat elements!');
        return;
    }

    // Clear any existing messages
    chatMessages.innerHTML = '';

    // Add greeting message
    const greeting = document.createElement('div');
    greeting.className = 'chat-message assistant';
    greeting.textContent = 'Hello! I can help you create tap sequences. What would you like to do?';
    chatMessages.appendChild(greeting);

    // Send message handler
    async function handleSendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        console.log('Sending message:', message);

        // Add user message
        const userMessage = document.createElement('div');
        userMessage.className = 'chat-message user';
        userMessage.textContent = message;
        chatMessages.appendChild(userMessage);

        // Clear input
        chatInput.value = '';

        // Show thinking message
        const thinkingMessage = document.createElement('div');
        thinkingMessage.className = 'chat-message assistant';
        thinkingMessage.textContent = 'Thinking...';
        chatMessages.appendChild(thinkingMessage);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: SYSTEM_PROMPT
                        },
                        { role: 'user', content: message }
                    ]
                })
            });

            const data = await response.json();
            chatMessages.removeChild(thinkingMessage);

            const responseMessage = document.createElement('div');
            responseMessage.className = 'chat-message assistant';

            try {
                const aiResponse = data.choices[0].message.content;
                console.log('AI Response:', aiResponse);

                const parsedResponse = JSON.parse(aiResponse);
                responseMessage.textContent = parsedResponse.message;
                chatMessages.appendChild(responseMessage);

                if (parsedResponse.command === 'add_blocks' && parsedResponse.params?.blocks) {
                    console.log('Creating blocks:', parsedResponse.params.blocks);
                    if (window.processBlocks) {
                        window.processBlocks(parsedResponse.params.blocks);
                    } else {
                        console.error('processBlocks function not found');
                    }
                }
            } catch (parseError) {
                console.error('Failed to parse AI response:', parseError);
                responseMessage.textContent = aiResponse;
                chatMessages.appendChild(responseMessage);
            }
        } catch (error) {
            console.error('Chat error:', error);
            chatMessages.removeChild(thinkingMessage);

            const errorMessage = document.createElement('div');
            errorMessage.className = 'chat-message assistant error';
            errorMessage.textContent = 'Sorry, I encountered an error. Please try again.';
            chatMessages.appendChild(errorMessage);
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Event listeners
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage();
        }
    });

    console.log('Chat initialization complete');
});

// Make add message available to other modules
window.addMessage = addMessage;
window.processBlocks = processBlocks;

// Make the simulator's functions available to chatbot.js
window.setBlockFocus = window.setBlockFocus || function() { console.warn('setBlockFocus not loaded'); };
window.showSelectionBox = window.showSelectionBox || function() { console.warn('showSelectionBox not loaded'); };
window.enableDrawingMode = window.enableDrawingMode || function() { console.warn('enableDrawingMode not loaded'); };

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

    if (window.state && window.state.currentTask && window.state.currentTask.blocks) {
        window.state.currentTask.blocks.forEach(block => {
            currentTaskElement.appendChild(renderBlock(block));
        });
    }
}

function logToConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    if (!console) return;

    const messageEl = document.createElement('div');
    messageEl.className = `text-${type}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageEl);
    console.scrollTop = console.scrollHeight;
}