// Chat state management
const state = {
    chatHistory: [],
    currentTask: null
};

// System prompt for the AI
const SYSTEM_PROMPT = `You are an AI assistant helping users create tap sequences for a touchscreen simulator. 
Respond in JSON format with a 'command' field and a human-readable 'message' field.
Available commands: 'create_task_with_blocks', 'execute'`;

// Helper function to add messages to the chat
function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}-message`;

    // If message contains JSON code block, extract only the human-readable message
    if (content.includes('