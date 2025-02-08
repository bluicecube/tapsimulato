// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// State management
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;

// Initialize state
window.state = {
    currentTask: null,
    tasks: [],
    autoSaveTimeout: null,
    pendingBlockConfiguration: null,
    focusedBlock: null,
    lastTaskId: localStorage.getItem('lastTaskId'),
    currentFrame: null
};

// Functions state
let functions = [];

// Logic block implementation
function addLogicBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'logic',
        name: 'Logic Block',
        data: {
            threshold: 90,
            referenceImage: null,
            thenBlocks: [],
            elseBlocks: []
        }
    };

    if (!state.currentTask.blocks) {
        state.currentTask.blocks = [];
    }

    state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logToConsole('Added Logic block', 'success');
}

// Load tasks from localStorage
async function loadTasks() {
    try {
        const storedTasks = localStorage.getItem('tasks');
        state.tasks = storedTasks ? JSON.parse(storedTasks) : [];
        updateTaskList();

        if (state.tasks.length > 0) {
            let taskToLoad;

            // Try to load last opened task
            if (state.lastTaskId) {
                taskToLoad = state.tasks.find(t => t.id === parseInt(state.lastTaskId));
            }

            // If no last task or it doesn't exist, load most recent
            if (!taskToLoad) {
                taskToLoad = state.tasks[0];
            }

            await loadTask(taskToLoad.id);
        } else {
            // Only create a new task if there are no existing tasks
            await createNewTask();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        logToConsole('Error loading tasks', 'error');

        // Create a new task as fallback
        if (!state.currentTask) {
            await createNewTask();
        }
    }
}

// Create new task using localStorage
async function createNewTask() {
    try {
        // Find highest task number
        const taskNumbers = state.tasks
            .map(t => {
                const match = t.name.match(/^Task (\d+)$/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(n => !isNaN(n));

        const nextNumber = taskNumbers.length > 0 ? Math.max(...taskNumbers) + 1 : 1;
        const taskId = Date.now(); // Use timestamp as ID

        const task = {
            id: taskId,
            name: `Task ${nextNumber}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Update state with the new task
        state.tasks.push(task);
        localStorage.setItem('tasks', JSON.stringify(state.tasks));

        // Set the new task as current
        state.currentTask = {
            id: task.id,
            blocks: []
        };

        // Save task blocks
        localStorage.setItem(`task_${task.id}_blocks`, JSON.stringify([]));

        // Save last opened task ID
        state.lastTaskId = task.id;
        localStorage.setItem('lastTaskId', task.id);

        // Update UI
        updateTaskList();
        updateTaskDisplay();

        const taskTitle = document.getElementById('taskTitle');
        if (taskTitle) {
            taskTitle.value = `Task ${nextNumber}`;
        }

        logToConsole('New task created', 'success');
        return task;
    } catch (error) {
        logToConsole('Error creating task', 'error');
        console.error('Error creating task:', error);
        throw error;
    }
}

// Load task from localStorage
async function loadTask(taskId) {
    try {
        // Load blocks from localStorage
        const blocks = JSON.parse(localStorage.getItem(`task_${taskId}_blocks`) || '[]');
        state.currentTask = {
            id: taskId,
            blocks: blocks.map(block => {
                if (block.type === 'tap') {
                    return {
                        ...block,
                        region: block.region || null
                    };
                } else if (block.type === 'loop') {
                    return {
                        ...block,
                        iterations: block.iterations || 1,
                        blocks: (block.blocks || []).map(nestedBlock => ({
                            ...nestedBlock,
                            region: nestedBlock.region || null
                        }))
                    };
                } else if (block.type === 'logic') {
                    return {
                        ...block,
                        data: {
                            threshold: block.data?.threshold || 90,
                            referenceImage: block.data?.referenceImage || null,
                            thenBlocks: block.data?.thenBlocks || [],
                            elseBlocks: block.data?.elseBlocks || []
                        }
                    };
                }
                return block;
            })
        };

        updateTaskDisplay();

        // Save last opened task ID
        state.lastTaskId = taskId;
        localStorage.setItem('lastTaskId', taskId);
    } catch (error) {
        console.error('Error loading task:', error);
        logToConsole('Error loading task', 'error');
    }
}

// Save current task to localStorage
async function saveCurrentTask() {
    if (!state.currentTask) return;

    try {
        // Save blocks
        localStorage.setItem(`task_${state.currentTask.id}_blocks`, JSON.stringify(state.currentTask.blocks));

        // Update task's updated_at timestamp
        const taskIndex = state.tasks.findIndex(t => t.id === state.currentTask.id);
        if (taskIndex !== -1) {
            state.tasks[taskIndex].updated_at = new Date().toISOString();
            localStorage.setItem('tasks', JSON.stringify(state.tasks));
        }
    } catch (error) {
        console.error('Error saving task:', error);
        logToConsole('Error saving task', 'error');
    }
}

// Delete all tasks
async function deleteAllTasks() {
    try {
        // Clear all task-related data from localStorage
        state.tasks.forEach(task => {
            localStorage.removeItem(`task_${task.id}_blocks`);
        });

        // Clear tasks array and save
        state.tasks = [];
        localStorage.setItem('tasks', JSON.stringify([]));

        // Create new task
        const newTask = await createNewTask();
        await loadTask(newTask.id);

        updateTaskList();
        updateTaskDisplay();
        logToConsole('All tasks deleted and new task created', 'success');
    } catch (error) {
        logToConsole('Error deleting all tasks', 'error');
        console.error('Error deleting all tasks:', error);
    }
}

// Event listener setup 
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements
    const selectionBox = document.getElementById('selectionBox');
    const simulator = document.getElementById('simulator');
    const taskTitle = document.getElementById('taskTitle');

    // Setup event listeners for task controls
    const executeTaskBtn = document.getElementById('executeTaskBtn');
    const addTapBtn = document.getElementById('addTapBtn');
    const addLoopBtn = document.getElementById('addLoopBtn');
    const addLogicBtn = document.getElementById('addLogicBtn');
    const newTaskBtn = document.getElementById('newTaskBtn');
    const deleteAllTasksBtn = document.getElementById('deleteAllTasksBtn');
    const addFunctionTapBtn = document.getElementById('addFunctionTapBtn');
    const addFunctionLoopBtn = document.getElementById('addFunctionLoopBtn');
    const saveFunctionBtn = document.getElementById('saveFunctionBtn');

    executeTaskBtn.addEventListener('click', executeTask);

    addTapBtn.addEventListener('click', () => {
        if (!state.currentTask) {
            logToConsole('Please create or select a task first', 'error');
            return;
        }
        addTapBlock();
    });

    addLoopBtn.addEventListener('click', () => {
        if (!state.currentTask) {
            logToConsole('Please create or select a task first', 'error');
            return;
        }
        addLoopBlock();
    });

    addLogicBtn.addEventListener('click', addLogicBlock);

    newTaskBtn.addEventListener('click', async () => {
        try {
            await createNewTask();
            logToConsole('New task created successfully', 'success');
        } catch (error) {
            logToConsole('Failed to create new task: ' + error.message, 'error');
        }
    });

    deleteAllTasksBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete all tasks?')) {
            return;
        }
        await deleteAllTasks();
    });

    taskTitle.addEventListener('change', async () => {
        if (state.currentTask) {
            const taskIndex = state.tasks.findIndex(t => t.id === state.currentTask.id);
            if (taskIndex !== -1) {
                state.tasks[taskIndex].name = taskTitle.value;
                localStorage.setItem('tasks', JSON.stringify(state.tasks));
                updateTaskList();
                logToConsole('Task name updated', 'success');
            }
        }
    });

    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);
    simulator.addEventListener('mouseleave', (event) => {
        if (isSelecting) {
            const rect = simulator.getBoundingClientRect();
            const lastKnownX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
            const lastKnownY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
            finishSelection(lastKnownY, lastKnownX);
        }
    });

    setupVideoSharing();
    loadFunctions();
    loadTasks().then(() => {
        console.log('Initial state setup complete:', window.state);
    });

    const functionModal = document.getElementById('functionModal');
    if (functionModal) {
        new bootstrap.Modal(functionModal);
    }

    saveFunctionBtn.addEventListener('click', saveFunction);
    addFunctionTapBtn.addEventListener('click', () => addBlockToFunction('tap'));
    addFunctionLoopBtn.addEventListener('click', () => addBlockToFunction('loop'));
});

function generateRandomCoordinates() {
    return {
        x: Math.floor(Math.random() * DEVICE_WIDTH),
        y: Math.floor(Math.random() * DEVICE_HEIGHT)
    };
}

// Placeholder functions -  These need to be defined elsewhere in your actual code.
function updateTaskList() {}
function updateTaskDisplay() {}
function scheduleAutosave() {}
function executeTask() {}
function addTapBlock() {}
function addLoopBlock() {}
function setupVideoSharing() {}
function loadFunctions() {}
function saveFunction() {}
function addBlockToFunction() {}
function startSelection() {}
function updateSelection() {}
function stopSelection() {}
function finishSelection() {}
function logToConsole(message, type) {
    console.log(message); //Basic log for demonstration.  Replace with actual logging.
}