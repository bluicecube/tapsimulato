let chatHistory = [];
const systemPrompt = `You are an AI assistant helping users create tap sequences for a touchscreen simulator. You can:
1. Create tap blocks (tap at specific screen coordinates)
2. Create loop blocks (repeat a sequence of taps)
3. Execute simulations
4. Modify existing blocks

Important dimensions:
- Screen width: 320px
- Screen height: 720px

Be friendly and always ask if the user wants to execute the sequence after creation.`;

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
    addMessage('assistant', 'Hello! I can help you create tap sequences. Try saying something like "create a sequence that taps all four corners" or "make a loop that taps the center 3 times".');
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
        await processCommands(assistantMessage);

    } catch (error) {
        console.error('Error:', error);
        hideThinking();
        addMessage('assistant', `I encountered an error: ${error.message}. Please try again.`);
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

async function processCommands(message) {
    // Create a new task if none exists
    if (!currentTask) {
        createNewTask();
    }

    const lowerMessage = message.toLowerCase();

    try {
        if (lowerMessage.includes('create a loop') || lowerMessage.includes('repeat')) {
            // Extract iteration count
            const iterationMatch = message.match(/(\d+)\s*times/);
            const iterations = iterationMatch ? parseInt(iterationMatch[1]) : 1;

            // Create loop block
            const loopDiv = addLoopBlock(currentTask);
            document.querySelector('.blocks-container').appendChild(loopDiv);

            // Create tap blocks within the loop based on corner mentions
            if (lowerMessage.includes('corner')) {
                const corners = [
                    { x: 20, y: 20 },        // Top-left
                    { x: 300, y: 20 },       // Top-right
                    { x: 20, y: 700 },       // Bottom-left
                    { x: 300, y: 700 }       // Bottom-right
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
        } else if (lowerMessage.includes('tap')) {
            const tapBlock = addTapBlock(currentTask);
            document.querySelector('.blocks-container').appendChild(tapBlock);

            // Set region based on description
            if (lowerMessage.includes('center')) {
                tapBlock.region = {
                    x1: 150,
                    y1: 350,
                    x2: 170,
                    y2: 370
                };
                showSelectionBox(tapBlock);
            }
        }

        // If the message suggests execution
        if (lowerMessage.includes('execute') || lowerMessage.includes('run') || lowerMessage.includes('simulate')) {
            executeSelectedTask();
        }

        saveTasksToStorage();
    } catch (error) {
        console.error('Error processing commands:', error);
        addMessage('assistant', 'Sorry, I had trouble creating that sequence. Could you try describing it differently?');
    }
}