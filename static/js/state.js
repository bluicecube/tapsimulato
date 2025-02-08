// Global state management
const state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null,
    focusedBlock: null,
    lastTaskId: localStorage.getItem('lastTaskId')
};

// Task state management functions
function updateState(updates) {
    Object.assign(state, updates);
}

function resetState() {
    state.currentTask = null;
    state.tasks = [];
    state.pendingBlockConfiguration = null;
    state.focusedBlock = null;
}

// Export state and functions
window.appState = state;
window.updateState = updateState;
window.resetState = resetState;
