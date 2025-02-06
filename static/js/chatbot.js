let chatHistory = [];
const systemPrompt = `You are a touchscreen task creator. Be direct and concise.

Commands you understand:
- "Create task [name]" -> Creates task, then ask what it should do
- "Tap each corner [X] times" -> Creates loop with X iterations and 4 corner taps
- "Tap [location]" -> Creates single tap at location
- "Run task" -> Executes current task

Keep responses under 10 words unless explaining a new concept.`;

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

        // Add chat history ensuring alternating pattern
        for (let i = 0; i < chatHistory.length - 1; i += 2) {
            if (chatHistory[i].role === 'user' && chatHistory[i + 1]?.role === 'assistant') {
                messages.push(chatHistory[i], chatHistory[i + 1]);
            }
        }

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
        addMessage('assistant', assistantMessage);

        // Process any commands in the response
        await processCommands(message, assistantMessage);

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

async function processCommands(userMessage, assistantMessage) {
    try {
        // Extract task name from creation request
        if (userMessage.toLowerCase().includes('create') && userMessage.toLowerCase().includes('task')) {
            const nameMatch = userMessage.toLowerCase().match(/called\s+([^.,!?]+)/i);
            if (nameMatch) {
                const taskName = nameMatch[1].trim();
                createNewTask();
                if (currentTask) {
                    currentTask.name = taskName;
                    saveTasksToStorage();
                    updateTaskList();
                    loadTask(currentTask);
                }
                return;
            }
        }

        // Only process commands if we have a current task
        if (currentTask) {
            const lowerUserMessage = userMessage.toLowerCase();

            // Handle tap corners command
            if (lowerUserMessage.includes('corner') && lowerUserMessage.includes('times')) {
                const iterationMatch = lowerUserMessage.match(/(\d+)\s*times/);
                const iterations = iterationMatch ? parseInt(iterationMatch[1]) : 2;

                const loopBlock = {
                    type: 'loop',
                    iterations: iterations,
                    blocks: [],
                    name: `${iterations}x Corner Taps`
                };
                currentTask.blocks.push(loopBlock);

                const loopDiv = addLoopBlock(loopBlock);
                document.querySelector('.blocks-container').appendChild(loopDiv);

                // Add the four corner taps
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

                    const tapDiv = addTapBlock(loopBlock);
                    loopDiv.querySelector('.nested-blocks').appendChild(tapDiv);
                    showSelectionBox(tapBlock);
                });

                addMessage('assistant', 'Added corner taps. Want to test it?');
            }
            // Handle single tap request
            else if (lowerUserMessage.includes('tap')) {
                const tapBlock = {
                    type: 'tap',
                    region: null,
                    name: 'Tap Block'
                };
                currentTask.blocks.push(tapBlock);

                const tapDiv = addTapBlock(currentTask);
                document.querySelector('.blocks-container').appendChild(tapDiv);
            }
        }

        saveTasksToStorage();
    } catch (error) {
        console.error('Error processing commands:', error);
        addMessage('assistant', 'I had trouble with that. Could you try describing what you want differently?');
    }
}