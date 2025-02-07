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

    // Show initial greeting with delay to ensure DOM is ready
    setTimeout(() => {
        if (chatMessages && state.chatHistory.length === 0) {
            addMessage('assistant', 'Hi! I can help you create tap sequences using tap and loop blocks. Would you like to create a new task?');
        }
    }, 500);
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeChat();
});

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