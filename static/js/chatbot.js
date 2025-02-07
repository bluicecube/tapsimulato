')) {
        try {
            const jsonStr = content.match(/```json\s*([\s\S]*?)\s*```/)[1];
            const parsed = JSON.parse(jsonStr);
            content = parsed.message;
        } catch (e) {
            console.error('Failed to parse JSON in message:', e);
        }
    }

    messageDiv.innerHTML = `
        ${content}
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    state.chatHistory.push({ role, content });
}

// Helper function to calculate region from description
function calculateRegionFromDescription(description) {
    const normalized = description.toLowerCase().trim();
    const DEVICE_WIDTH = 320;
    const DEVICE_HEIGHT = 720;

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

// Process commands from the AI
async function processCommand(responseData) {
    try {
        const { command, params } = responseData;

        switch (command) {
            case 'create_task_with_blocks':
                const taskName = params.taskName || 'New Task';
                const newTask = window.simulatorAPI.createNewTask();
                newTask.name = taskName;

                if (params.blocks && params.blocks.length > 0) {
                    const processedBlocks = params.blocks.map(block => {
                        if (block.type === 'loop') {
                            return {
                                type: 'loop',
                                iterations: block.iterations || 1,
                                blocks: block.blocks.map(b => ({
                                    type: 'tap',
                                    region: calculateRegionFromDescription(b.location),
                                    name: `Tap ${b.location}`
                                }))
                            };
                        } else {
                            return {
                                type: 'tap',
                                region: calculateRegionFromDescription(block.location),
                                name: `Tap ${block.location}`
                            };
                        }
                    });
                    window.simulatorAPI.addBlocksToChatbotTask(newTask, processedBlocks);
                }
                break;

            case 'execute':
                if (state.currentTask) {
                    window.simulatorAPI.executeSelectedTask();
                }
                break;
        }
    } catch (error) {
        console.error('Error processing command:', error);
        addMessage('assistant', 'Error processing command. Please try again.');
    }
}

// Initialize chat interface
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');

    if (!chatMessages) {
        console.error('Chat container not found');
        return;
    }

    // Clear existing messages
    chatMessages.innerHTML = '';

    if (chatInput && sendButton) {
        sendButton.addEventListener('click', handleMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMessage(e);
        });
    }

    // Show initial greeting
    setTimeout(() => {
        if (state.chatHistory.length === 0) {
            addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. Would you like to create a new task?');
        }
    }, 500);
}

// Message handling
async function handleMessage(event) {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    addMessage('user', message);

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...state.chatHistory.slice(-4),
            { role: 'user', content: message }
        ];

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const assistantMessage = data.choices[0].message.content;
        let responseData;

        try {
            // Try to parse the JSON from the message
            if (assistantMessage.includes('```json')) {
                const jsonStr = assistantMessage.match(/```json\s*([\s\S]*?)\s*