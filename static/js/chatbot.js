let chatHistory = [];
const systemPrompt = `You are a touchscreen task automation assistant. Help users create and manage tap sequences.
For task-related commands, respond in this JSON format:
{
    "command": "<command_type>",
    "params": {
        // command specific parameters
    },
    "message": "human readable response"
}`;

// Keep the original simple version of addMessage
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

// Simplify back to the original initialization
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

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

async function processCommand(response_data) {
    try {
        console.log('Processing command:', response_data);
        const { command, params } = response_data;

        // Get the blocks container for the current task
        const currentTaskElement = document.getElementById('currentTask');
        const blocksContainer = currentTaskElement?.querySelector('.blocks-container');
        if (!blocksContainer && command !== 'create_task') {
            addMessage('assistant', 'Please create a task first.');
            return;
        }

        switch (command) {
            case 'create_task':
                createNewTask();
                if (params.taskName) {
                    currentTask.name = params.taskName;
                    const taskNameElement = document.querySelector('.task-name');
                    if (taskNameElement) {
                        taskNameElement.textContent = params.taskName;
                    }
                    saveTasksToStorage();
                    updateTaskList();
                }
                break;

            case 'add_corner_taps':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                // Create the main loop block that will contain the corner taps
                const loopBlock = {
                    type: 'loop',
                    iterations: params.iterations || 4,
                    blocks: [],
                    name: 'Corner Taps Loop'
                };
                currentTask.blocks.push(loopBlock);

                // Create and add the loop div
                const loopDiv = addLoopBlock(currentTask, params.iterations || 4);
                blocksContainer.appendChild(loopDiv);

                // Get the nested blocks container where we'll add the tap blocks
                const nestedBlocks = loopDiv.querySelector('.nested-blocks');

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

                    // Create the tap block UI element
                    const tapDiv = addTapBlock(loopBlock);
                    if (nestedBlocks) {
                        nestedBlocks.appendChild(tapDiv);
                        showSelectionBox(tapBlock);
                    }
                });

                saveTasksToStorage();
                break;

            case 'execute':
                executeSelectedTask();
                break;

            default:
                console.log('Unknown command:', command);
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

function createNewTask() {
    const task = {
        id: `task-${Date.now()}`,
        name: 'New Task',
        blocks: [],
        minimized: false,
        created: new Date().toISOString()
    };
    tasks.push(task);
    currentTask = task;

    // Update the current task display
    const currentTaskElement = document.getElementById('currentTask');
    currentTaskElement.innerHTML = '';
    addTaskBlock(task);

    // Auto-save
    saveTasksToStorage();
    updateTaskList();

    return task;
}

function addTapBlock(parent) {
    //This function is not fully defined in the original code.  Leaving as is.
}

function saveTasksToStorage() {
    localStorage.setItem('savedTasks', JSON.stringify(tasks));
    localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
}

function updateTaskList() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    taskList.innerHTML = '';

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-list-item';
        if (currentTask && currentTask.id === task.id) {
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

        // Make the entire task item clickable
        taskItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-task-btn')) {
                loadTask(task);
                // Update active state
                document.querySelectorAll('.task-list-item').forEach(item => item.classList.remove('active'));
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

function loadTask(taskToLoad){
    //This function is not fully defined in the original code.  Leaving as is.
}

function executeSelectedTask(){
    //This function is not fully defined in the original code.  Leaving as is.
}

function showSelectionBox(tapBlock){
    //This function is not fully defined in the original code.  Leaving as is.
}

function deleteTask(task) {
    const index = tasks.indexOf(task);
    if (index > -1) {
        deletedTasks.push(tasks.splice(index, 1)[0]);
    }
    saveTasksToStorage();
    updateTaskList();
}

let tasks = JSON.parse(localStorage.getItem('savedTasks')) || [];
let deletedTasks = JSON.parse(localStorage.getItem('deletedTasks')) || [];
let currentTask = null;

function addTaskBlock(task) {
    const taskContainer = document.getElementById('currentTask');
    const blocksContainer = document.createElement('div');
    blocksContainer.className = 'blocks-container';
    taskContainer.appendChild(blocksContainer);
}