let chatHistory = [];
const systemPrompt = `You are a friendly assistant that helps users create tap sequences. Keep your responses brief and action-focused. Do not explain technical details or coordinates.

When users want to create sequences:
1. Ask if they want to create a new task or modify existing one
2. Ask for a task name if creating new
3. Create the requested blocks
4. Briefly confirm what you've done
5. Ask if they want to see it in action

Example response: "I'll create a new task for that. What would you like to call it?"
Or: "I've added the tap sequence you requested. Would you like to see it in action?"`;

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
        // Prepare messages array ensuring alternating pattern
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
    const lowerUserMessage = userMessage.toLowerCase();
    const lowerAssistantMessage = assistantMessage.toLowerCase();

    try {
        // Handle task creation/modification
        if (lowerAssistantMessage.includes('new task') && lowerAssistantMessage.includes('call it')) {
            // Create new task with provided name
            const taskName = userMessage.trim();
            createNewTask();
            if (currentTask) {
                currentTask.name = taskName;
                saveTasksToStorage();
                updateTaskList();
            }
            return;
        }

        // Create a new task if none exists
        if (!currentTask && (lowerUserMessage.includes('create') || lowerUserMessage.includes('new'))) {
            createNewTask();
        }

        // Process tap and loop commands
        if (lowerUserMessage.includes('create') || lowerUserMessage.includes('add') || lowerUserMessage.includes('tap')) {
            if (lowerUserMessage.includes('loop') || lowerUserMessage.includes('repeat')) {
                // Extract iteration count
                const iterationMatch = userMessage.match(/(\d+)\s*times/);
                const iterations = iterationMatch ? parseInt(iterationMatch[1]) : 1;

                // Create loop block
                const loopDiv = addLoopBlock(currentTask);
                document.querySelector('.blocks-container').appendChild(loopDiv);

                // Handle corner taps
                if (lowerUserMessage.includes('corner')) {
                    const corners = [
                        { x: 20, y: 20 },    // Top-left
                        { x: 300, y: 20 },   // Top-right
                        { x: 20, y: 700 },   // Bottom-left
                        { x: 300, y: 700 }   // Bottom-right
                    ];

                    corners.forEach(corner => {
                        const tapBlock = addTapBlock(currentTask);
                        tapBlock.region = {
                            x1: corner.x - 10,
                            y1: corner.y - 10,
                            x2: corner.x + 10,
                            y2: corner.y + 10
                        };
                        showSelectionBox(tapBlock);
                    });
                }
            } else if (lowerUserMessage.includes('tap')) {
                const tapBlock = addTapBlock(currentTask);
                document.querySelector('.blocks-container').appendChild(tapBlock);

                // Set region based on description
                if (lowerUserMessage.includes('center')) {
                    tapBlock.region = {
                        x1: 150,
                        y1: 350,
                        x2: 170,
                        y2: 370
                    };
                    showSelectionBox(tapBlock);
                }
            }
        }

        // Execute if requested
        if (lowerAssistantMessage.includes('see it in action') && lowerUserMessage.includes('yes')) {
            executeSelectedTask();
        }

        saveTasksToStorage();
    } catch (error) {
        console.error('Error processing commands:', error);
        addMessage('assistant', 'I had trouble with that. Could you try describing what you want differently?');
    }
}