// Initialize state
const state = {
    chatHistory: []
};

// Chat UI functions
function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat container not found');
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.innerHTML = `
        ${content}
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add to history
    state.chatHistory.push({ role, content });
}

// Initialize
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');

    if (chatInput && sendButton) {
        sendButton.addEventListener('click', handleMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMessage(e);
        });
    }

    // Show initial greeting
    addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. Would you like to create a new task?');
}

// Ensure DOM is loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChat);
} else {
    initializeChat();
}

// Message handling
async function handleMessage(event) {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Clear input
    chatInput.value = '';

    // Add user message
    addMessage('user', message);

    // Show thinking indicator
    showThinking();

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
        hideThinking();

        if (data.error) throw new Error(data.error);

        const assistantMessage = data.choices[0].message.content;
        let responseData;

        try {
            responseData = JSON.parse(assistantMessage);
        } catch (e) {
            responseData = {
                command: 'chat',
                params: {},
                message: assistantMessage
            };
        }

        // Add assistant's message to chat
        addMessage('assistant', responseData.message);

        // Process any commands
        if (responseData.command !== 'chat') {
            await processCommand(responseData);
        }

    } catch (error) {
        console.error('Error:', error);
        hideThinking();
        addMessage('assistant', 'Sorry, something went wrong. Please try again.');
    }
}

function showThinking() {
    const chatMessages = document.getElementById('chatMessages');
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'chat-thinking';
    thinkingDiv.id = 'thinkingIndicator';
    thinkingDiv.innerHTML = `
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
    `;
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideThinking() {
    const thinkingDiv = document.getElementById('thinkingIndicator');
    if (thinkingDiv) {
        thinkingDiv.remove();
    }
}

// Export necessary functions for external use
window.addMessage = addMessage;
window.handleMessage = handleMessage;
window.processCommand = processCommand;

// Placeholder for processCommand -  This needs to be defined elsewhere or provided as part of the original code.
async function processCommand(response_data) {
    //  Implementation for processing commands would go here.
    // This is a placeholder; the actual implementation is likely in the original file and needs to be included.
    console.log("Processing command:", response_data);
    addMessage('assistant', "Command received and processed (placeholder).");
}