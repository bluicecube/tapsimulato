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
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...chatHistory.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    })),
                    { role: 'user', content: message }
                ]
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        // Hide thinking indicator
        hideThinking();
        
        // Process the response
        const assistantMessage = data.choices[0].message.content;
        addMessage('assistant', assistantMessage);
        
        // Process any commands in the response
        await processCommands(assistantMessage);
        
    } catch (error) {
        console.error('Error:', error);
        hideThinking();
        addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
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
    
    if (message.toLowerCase().includes('create a loop') || message.toLowerCase().includes('repeat')) {
        // Extract iteration count
        const iterationMatch = message.match(/(\d+)\s*times/);
        const iterations = iterationMatch ? parseInt(iterationMatch[1]) : 1;
        
        // Create loop block
        const loopDiv = addLoopBlock(currentTask);
        document.querySelector('.blocks-container').appendChild(loopDiv);
        
        // Create tap blocks within the loop based on corner mentions
        if (message.toLowerCase().includes('corner')) {
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
    } else if (message.toLowerCase().includes('tap')) {
        const tapBlock = addTapBlock(currentTask);
        document.querySelector('.blocks-container').appendChild(tapBlock);
        
        // Set region based on description
        if (message.toLowerCase().includes('center')) {
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
    if (message.toLowerCase().includes('execute') || message.toLowerCase().includes('run') || message.toLowerCase().includes('simulate')) {
        executeSelectedTask();
    }
    
    saveTasksToStorage();
}
