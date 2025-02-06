let chatHistory = [];
const systemPrompt = `You are a touchscreen task automation assistant. Help users create and manage tap sequences.
For task-related commands, respond in this JSON format:
{
    "command": "<command_type>",
    "params": {
        // command specific parameters
    },
    "message": "human readable response"
}

Available commands:
1. Create task:
   Input: "create a new task called <name>" or similar
   Command: "create_task"
   Params: {"taskName": "<name>"}

2. Add tap:
   Input: "add a tap" or "tap <location>" (e.g., "tap top left", "tap middle", "tap bottom right")
   Command: "add_tap"
   Params: {
       "location": "<location>",  // "top-left", "top-right", "bottom-left", "bottom-right", "middle"
       "custom_name": "<optional name>"
   }

3. Add loop:
   Input: "add a loop" or "create a loop"
   Command: "add_loop"
   Params: {"iterations": <number>}

4. Corner taps:
   Input: "tap each corner <N> times" or "tap corners <N> times"
   Command: "add_corner_taps"
   Params: {"iterations": <number>}

5. Remove blocks:
   Input: "remove all blocks" or "remove last block" or "clear blocks"
   Command: "remove_blocks"
   Params: {"target": "all" | "last"}

6. Load task:
   Input: "load task <name>" or "switch to task <name>"
   Command: "load_task"
   Params: {"taskName": "<name>"}

7. Execute task:
   Input: "run the task" or "execute" or "start task"
   Command: "execute"
   Params: {}

Keep messages short and clear. Always respond with valid JSON.
For general conversation (like "hi", "thanks"), use:
{
    "command": "chat",
    "params": {},
    "message": "your response"
}

For tap locations, understand these natural language inputs:
- "top left", "upper left" → top-left quadrant
- "top right", "upper right" → top-right quadrant
- "bottom left", "lower left" → bottom-left quadrant
- "bottom right", "lower right" → bottom-right quadrant
- "middle", "center" → center region
- "top", "top center" → top middle region
- "bottom", "bottom center" → bottom middle region
- "left", "left center" → left middle region
- "right", "right center" → right middle region

If user asks to add/create something but the command is unclear,
respond with a chat message asking for clarification.`;

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');

    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add initial greeting
    addMessage('assistant', 'Hi! I can help you create tap sequences. Would you like to create a new task?');
});

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Clear input
    chatInput.value = '';

    // Add user message to chat
    addMessage('user', message);

    // Show thinking indicator
    showThinking();

    try {
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add relevant chat history
        chatHistory.slice(-4).forEach(msg => messages.push(msg));

        // Add the latest user message
        messages.push({ role: 'user', content: message });

        console.log('Sending chat request:', messages);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages })
        });

        const data = await response.json();
        console.log('Received chat response:', data);

        // Hide thinking indicator
        hideThinking();

        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }

        // Process the response
        const assistantMessage = data.choices[0].message.content;
        console.log('Processing assistant message:', assistantMessage);

        let response_data;
        try {
            response_data = JSON.parse(assistantMessage);
            console.log('Parsed response data:', response_data);
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            response_data = {
                command: 'chat',
                params: {},
                message: assistantMessage
            };
        }

        // Add the assistant's message to chat
        addMessage('assistant', response_data.message);

        // Only process command if it's not a chat command
        if (response_data.command !== 'chat') {
            console.log('Processing command:', response_data.command);
            await processCommand(response_data);
        }

    } catch (error) {
        console.error('Error:', error);
        hideThinking();
        addMessage('assistant', `Sorry, something went wrong. Please try again.`);
    }
}

function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.innerHTML = `
        ${content}
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add to history
    chatHistory.push({ role, content });
}

function showThinking() {
    const chatMessages = document.getElementById('chatMessages');
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'chat-thinking';
    thinkingDiv.innerHTML = `
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
    `;
    thinkingDiv.id = 'thinkingIndicator';
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideThinking() {
    const thinkingDiv = document.getElementById('thinkingIndicator');
    if (thinkingDiv) {
        thinkingDiv.remove();
    }
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
        'top-center': 'top',
        'bottom-center': 'bottom',
        'left-center': 'left',
        'right-center': 'right'
    };

    const regionKey = locationMap[normalized] || normalized;
    return regions[regionKey] || regions['middle'];
}

async function processCommand(response_data) {
    try {
        console.log('Processing command:', response_data);
        const { command, params } = response_data;

        // Get the blocks container for the current task
        const currentTaskElement = document.getElementById('currentTask');
        const blocksContainer = currentTaskElement?.querySelector('.blocks-container');
        if (!blocksContainer && command !== 'create_task' && command !== 'load_task') {
            addMessage('assistant', 'Please create or load a task first.');
            return;
        }

        switch (command) {
            case 'create_task':
                console.log('Creating new task with params:', params);
                createNewTask();
                if (currentTask && params.taskName) {
                    currentTask.name = params.taskName;
                    const taskNameElement = document.querySelector('.task-name');
                    if (taskNameElement) {
                        taskNameElement.textContent = params.taskName;
                    }
                    saveTasksToStorage();
                    updateTaskList();
                }
                break;

            case 'add_tap':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }
                const tapDiv = addTapBlock(currentTask);
                blocksContainer.appendChild(tapDiv);

                // If location is specified, set the tap region
                if (params.location) {
                    const region = getRegionForLocation(params.location);
                    const tapBlock = currentTask.blocks[currentTask.blocks.length - 1];
                    tapBlock.region = region;
                    tapBlock.name = params.custom_name || `Tap ${params.location}`;
                    showSelectionBox(tapBlock);
                }

                saveTasksToStorage();
                break;

            case 'add_loop':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }
                const loopBlock = {
                    type: 'loop',
                    iterations: params.iterations || 1,
                    blocks: [],
                    name: 'Loop Block'
                };
                currentTask.blocks.push(loopBlock);
                const loopDiv = addLoopBlock(currentTask, params.iterations);
                blocksContainer.appendChild(loopDiv);
                saveTasksToStorage();
                break;

            case 'remove_blocks':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                if (params.target === 'all') {
                    currentTask.blocks = [];
                    blocksContainer.innerHTML = '';
                } else if (params.target === 'last') {
                    if (currentTask.blocks.length > 0) {
                        currentTask.blocks.pop();
                        const lastBlock = blocksContainer.lastChild;
                        if (lastBlock) {
                            lastBlock.remove();
                        }
                    }
                }
                saveTasksToStorage();
                break;

            case 'load_task':
                const taskToLoad = tasks.find(t => t.name.toLowerCase() === params.taskName.toLowerCase());
                if (taskToLoad) {
                    loadTask(taskToLoad);
                } else {
                    addMessage('assistant', `Could not find task named "${params.taskName}"`);
                }
                break;

            case 'add_corner_taps':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                const iterations = params.iterations || 2;
                const cornerLoopBlock = {
                    type: 'loop',
                    iterations: iterations,
                    blocks: [],
                    name: `${iterations}x Corner Taps`
                };
                currentTask.blocks.push(cornerLoopBlock);

                const cornerLoopDiv = addLoopBlock(currentTask);
                blocksContainer.appendChild(cornerLoopDiv);

                const corners = [
                    { x: 20, y: 20, name: 'Top Left' },
                    { x: 300, y: 20, name: 'Top Right' },
                    { x: 20, y: 700, name: 'Bottom Left' },
                    { x: 300, y: 700, name: 'Bottom Right' }
                ];

                corners.forEach(corner => {
                    const tapBlock = {
                        type: 'tap',
                        region: {
                            x1: corner.x - 10,
                            y1: corner.y - 10,
                            x2: corner.x + 10,
                            y2: corner.y + 10
                        },
                        name: `${corner.name} Corner`
                    };
                    cornerLoopBlock.blocks.push(tapBlock);

                    const tapDiv = addTapBlock(tapBlock);
                    const nestedBlocks = cornerLoopDiv.querySelector('.nested-blocks');
                    if (nestedBlocks) {
                        nestedBlocks.appendChild(tapDiv);
                    }
                    showSelectionBox(tapBlock);
                });
                break;

            case 'execute':
                executeSelectedTask();
                break;
        }

        saveTasksToStorage();
    } catch (error) {
        console.error('Error processing command:', error);
        addMessage('assistant', 'I had trouble with that. Could you try describing what you want differently?');
    }
}

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
        saveTasksToStorage();
    });

    blockDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(loopBlock);
        blockDiv.querySelector('.nested-blocks').appendChild(tapDiv);
        saveTasksToStorage();
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