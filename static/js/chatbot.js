')) {
        try {
            // Extract only the JSON object from the message
            const jsonStr = content.match(/```json\s*([\s\S]*?)\s*```/)[1];
            const parsed = JSON.parse(jsonStr);
            // Use only the human-readable message
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
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendChatBtn');

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
        let responseData;

        try {
            // Try to parse the JSON directly first
            responseData = JSON.parse(assistantMessage);
        } catch (e) {
            try {
                // If direct parse fails, try to extract JSON from markdown
                const jsonMatch = assistantMessage.match(/```json\s*([\s\S]*?)\s*