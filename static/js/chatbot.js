let chatHistory = [];
const systemPrompt = `You are a touchscreen sequence creator. Your ONLY purpose is to help users create tap and loop sequences for a touchscreen device. 

ONLY discuss:
1. Creating new tasks
2. Naming tasks
3. Adding tap sequences
4. Adding loop sequences
5. Executing sequences

NEVER discuss:
- Song meanings
- Word definitions
- General topics
- Technical details

Example responses ONLY:
"I'll create a new task! What would you like to call it?"
"Got it - I've added the taps. Want to see it in action?"
"Sure, I'll create a loop that taps 4 times. Ready to run it?"`;

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
        // Check if this is a task name response
        if (lowerAssistantMessage.includes('what would you like to call it')) {
            // Create new task and focus it
            createNewTask();
            if (currentTask) {
                currentTask.name = userMessage.trim(); // Use the raw user message as the name
                saveTasksToStorage();
                updateTaskList();
                // Ensure task is in focus
                loadTask(currentTask);
            }
            return;
        }

        // Handle task creation request
        if (!currentTask && (lowerUserMessage.includes('create') || lowerUserMessage.includes('new'))) {
            return; // Wait for name response
        }

        // Only process tap/loop commands if we have a current task
        if (currentTask) {
            if (lowerUserMessage.includes('loop') || lowerUserMessage.includes('repeat')) {
                // Extract iteration count
                const iterationMatch = userMessage.match(/(\d+)\s*times/);
                const iterations = iterationMatch ? parseInt(iterationMatch[1]) : 1;

                // Create loop block
                const loopBlock = {
                    type: 'loop',
                    iterations: iterations,
                    blocks: []
                };
                currentTask.blocks.push(loopBlock);

                // Add the loop block to UI
                const loopDiv = addLoopBlock(currentTask);
                document.querySelector('.blocks-container').appendChild(loopDiv);

                // Handle corner taps within loop
                if (lowerUserMessage.includes('corner')) {
                    const corners = [
                        { x: 20, y: 20 },    // Top-left
                        { x: 300, y: 20 },   // Top-right
                        { x: 20, y: 700 },   // Bottom-left
                        { x: 300, y: 700 }   // Bottom-right
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
                            name: 'Corner Tap'
                        };
                        loopBlock.blocks.push(tapBlock);

                        // Add tap block to UI
                        const tapDiv = addTapBlock(loopBlock);
                        loopDiv.querySelector('.nested-blocks').appendChild(tapDiv);
                        showSelectionBox(tapBlock);
                    });
                }
            } else if (lowerUserMessage.includes('tap')) {
                const tapBlock = {
                    type: 'tap',
                    region: null,
                    name: 'Tap Block'
                };
                currentTask.blocks.push(tapBlock);

                const tapDiv = addTapBlock(currentTask);
                document.querySelector('.blocks-container').appendChild(tapDiv);

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