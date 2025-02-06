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
   Input: "add a tap" or "create a tap block"
   Command: "add_tap"
   Params: {}

3. Add loop:
   Input: "add a loop" or "create a loop"
   Command: "add_loop"
   Params: {"iterations": <number>}

4. Corner taps:
   Input: "tap each corner <N> times" or "tap corners <N> times"
   Command: "add_corner_taps"
   Params: {"iterations": <number>}

5. Execute task:
   Input: "run the task" or "execute"
   Command: "execute"
   Params: {}

Keep messages short and clear. Always respond with valid JSON.
For general conversation (like "hi", "thanks"), use:
{
    "command": "chat",
    "params": {},
    "message": "your response"
}

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
                saveTasksToStorage();
                break;

            case 'add_loop':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }
                const loopDiv = addLoopBlock(currentTask);
                blocksContainer.appendChild(loopDiv);
                saveTasksToStorage();
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

                const cornerLoopDiv = addLoopBlock(cornerLoopBlock);
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