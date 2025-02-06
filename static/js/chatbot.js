let chatHistory = [];
const systemPrompt = `You are a touchscreen task automation assistant. Help users create and manage tap sequences.
For task-related commands, respond in this JSON format:
{
    "command": "create_task",
    "params": {
        "taskName": "given name",
        "iterations": 1
    },
    "message": "human readable response"
}

For conversational responses where no specific command is needed, respond in this format:
{
    "command": "chat",
    "params": {},
    "message": "your response here"
}

Available commands:
1. For new task:
   Input: "create a new task called <name>"
   Command: "create_task"
   Params: {"taskName": "<name>"}

2. For corner taps:
   Input: "tap each corner <N> times"
   Command: "add_corner_taps"
   Params: {"iterations": N}

3. For execution:
   Input: "run the task" or "execute"
   Command: "execute"
   Params: {}

Keep messages short and clear. Always respond with valid JSON.
For general conversation (like "yes", "no", "hello"), use the "chat" command.`;

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

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages })
        });

        const data = await response.json();

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
        let response_data;
        try {
            response_data = JSON.parse(assistantMessage);
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
    const thinkingIndicator = document.getElementById('thinkingIndicator');
    if (thinkingIndicator) {
        thinkingIndicator.remove();
    }
}

async function processCommand(response_data) {
    try {
        const { command, params } = response_data;

        switch (command) {
            case 'create_task':
                createNewTask();
                if (currentTask && params.taskName) {
                    currentTask.name = params.taskName;
                    saveTasksToStorage();
                    updateTaskList();
                    loadTask(currentTask);
                }
                break;

            case 'add_corner_taps':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                const iterations = params.iterations || 2;
                const loopBlock = {
                    type: 'loop',
                    iterations: iterations,
                    blocks: [],
                    name: `${iterations}x Corner Taps`
                };
                currentTask.blocks.push(loopBlock);

                const loopDiv = addLoopBlock(loopBlock);
                const blocksContainer = document.querySelector('.blocks-container');
                if (blocksContainer) {
                    blocksContainer.appendChild(loopDiv);
                }

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
                    loopBlock.blocks.push(tapBlock);

                    const tapDiv = addTapBlock(tapBlock);
                    const nestedBlocks = loopDiv.querySelector('.nested-blocks');
                    if (nestedBlocks) {
                        nestedBlocks.appendChild(tapDiv);
                    }
                    showSelectionBox(tapBlock);
                });
                break;

            case 'add_tap':
                if (!currentTask) {
                    addMessage('assistant', 'Please create a task first.');
                    return;
                }

                const tapBlock = {
                    type: 'tap',
                    region: null,
                    name: 'New Tap'
                };
                currentTask.blocks.push(tapBlock);

                const tapDiv = addTapBlock(tapBlock);
                blocksContainer = document.querySelector('.blocks-container');
                if (blocksContainer) {
                    blocksContainer.appendChild(tapDiv);
                }
                break;

            case 'execute':
                executeSelectedTask();
                break;
        }

        saveTasksToStorage();
    } catch (error) {
        console.error('Error processing command:', error);
        addMessage('assistant', 'I had trouble with that. Could you try again?');
    }
}