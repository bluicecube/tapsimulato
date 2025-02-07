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

    // Screen dimensions must match the CSS variables
    const DEVICE_WIDTH = 320;
    const DEVICE_HEIGHT = 720;

    // Define screen regions with actual coordinates
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

    // Try to match description to a region
    for (const [key, region] of Object.entries(regions)) {
        if (normalized.includes(key)) {
            return region;
        }
    }

    // Default to center if no match
    return regions.center;
}

// Command processing
async function processCommand(responseData) {
    try {
        const { command, params, message } = responseData;

        switch (command) {
            case 'create_task_with_blocks':
                const taskName = params.taskName || 'New Task';
                // Create new task with specified name
                const newTask = window.simulatorAPI.createNewTask();
                // Update task name
                newTask.name = taskName;
                // Process and add blocks
                if (params.blocks && params.blocks.length > 0) {
                    const processedBlocks = params.blocks.map(block => {
                        if (block.type === 'loop') {
                            return {
                                type: 'loop',
                                iterations: block.iterations || 1,
                                blocks: block.blocks.map(b => ({
                                    type: 'tap',
                                    region: calculateRegionFromDescription(b.location),
                                    name: b.name || 'Tap Block'
                                }))
                            };
                        } else {
                            return {
                                type: 'tap',
                                region: calculateRegionFromDescription(block.location),
                                name: block.name || 'Tap Block'
                            };
                        }
                    });
                    window.simulatorAPI.addBlocksToChatbotTask(newTask, processedBlocks);
                }
                console.log('Created task with blocks:', processedBlocks);
                break;

            case 'execute':
                if (!state.currentTask) {
                    addMessage('assistant', 'Please select a task to execute.');
                    return;
                }
                window.simulatorAPI.executeSelectedTask();
                break;

            default:
                console.log('Unknown command:', command);
        }
    } catch (error) {
        console.error('Error processing command:', error);
        addMessage('assistant', 'Error processing command. Please try again.');
    }
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

        try {
            const responseData = JSON.parse(assistantMessage);
            addMessage('assistant', responseData.message);
            await processCommand(responseData);
        } catch (e) {
            if (assistantMessage.includes('```json')) {
                // Try to extract JSON from markdown code block
                const jsonMatch = assistantMessage.match(/```json\s*([\s\S]*?)\s*