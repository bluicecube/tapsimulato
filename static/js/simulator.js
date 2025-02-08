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
    focusedBlock: null,  // Track currently focused block
    lastTaskId: localStorage.getItem('lastTaskId'), // Track last opened task
    currentFrame: null  // Store current video frame
};

// Functions state
let functions = [];

// Add Conditional Block
function addConditionalBlock() {
    if (!state.currentTask) {
        logToConsole('Please create or select a task first', 'error');
        return;
    }

    const block = {
        type: 'conditional',
        name: 'Conditional Block',
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
    logToConsole('Added Conditional block', 'success');
}

// State management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements
    const selectionBox = document.getElementById('selectionBox');
    const simulator = document.getElementById('simulator');
    const taskTitle = document.getElementById('taskTitle');

    // Setup event listeners for task controls
    const executeTaskBtn = document.getElementById('executeTaskBtn');
    const addTapBtn = document.getElementById('addTapBtn');
    const addLoopBtn = document.getElementById('addLoopBtn');
    const addConditionalBtn = document.getElementById('addConditionalBtn');
    const newTaskBtn = document.getElementById('newTaskBtn');
    const deleteAllTasksBtn = document.getElementById('deleteAllTasksBtn');
    const addFunctionTapBtn = document.getElementById('addFunctionTapBtn');
    const addFunctionLoopBtn = document.getElementById('addFunctionLoopBtn');
    const saveFunctionBtn = document.getElementById('saveFunctionBtn');

    if (executeTaskBtn) {
        executeTaskBtn.addEventListener('click', executeTask);
    }

    if (addTapBtn) {
        addTapBtn.addEventListener('click', () => {
            if (!state.currentTask) {
                logToConsole('Please create or select a task first', 'error');
                return;
            }
            addTapBlock();
        });
    }

    if (addLoopBtn) {
        addLoopBtn.addEventListener('click', () => {
            if (!state.currentTask) {
                logToConsole('Please create or select a task first', 'error');
                return;
            }
            addLoopBlock();
        });
    }

    if (addConditionalBtn) {
        addConditionalBtn.addEventListener('click', addConditionalBlock);
    }

    if (newTaskBtn) {
        newTaskBtn.addEventListener('click', async () => {
            try {
                await createNewTask();
                logToConsole('New task created successfully', 'success');
            } catch (error) {
                logToConsole('Failed to create new task: ' + error.message, 'error');
            }
        });
    }

    if (deleteAllTasksBtn) {
        deleteAllTasksBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete all tasks?')) {
                return;
            }
            try {
                const response = await fetch('/api/tasks/all', {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Failed to delete all tasks');

                // Clear tasks from state
                state.tasks = [];
                state.currentTask = null;

                // Create a new task
                const newTask = await createNewTask();
                await loadTask(newTask.id);

                updateTaskList();
                updateTaskDisplay();
                logToConsole('All tasks deleted and new task created', 'success');
            } catch (error) {
                logToConsole('Error deleting all tasks', 'error');
            }
        });
    }

    // Add task title change handler
    if (taskTitle) {
        taskTitle.addEventListener('change', async () => {
            if (state.currentTask) {
                try {
                    const response = await fetch(`/api/tasks/${state.currentTask.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: taskTitle.value
                        })
                    });

                    if (!response.ok) throw new Error('Failed to update task name');

                    const updatedTask = await response.json();
                    const taskIndex = state.tasks.findIndex(t => t.id === updatedTask.id);
                    if (taskIndex !== -1) {
                        state.tasks[taskIndex] = updatedTask;
                        updateTaskList();
                    }

                    logToConsole('Task name updated', 'success');
                } catch (error) {
                    logToConsole('Failed to update task name', 'error');
                }
            }
        });
    }

    // Selection events
    if (simulator) {
        simulator.addEventListener('mousedown', startSelection);
        simulator.addEventListener('mousemove', updateSelection);
        simulator.addEventListener('mouseup', stopSelection);
        simulator.addEventListener('mouseleave', (event) => {
            if (isSelecting) {
                const rect = simulator.getBoundingClientRect();
                const lastKnownX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
                const lastKnownY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
                finishSelection(lastKnownY, lastKnownX); // Note: X and Y coordinates were swapped
            }
        });
    }

    // Initialize
    setupVideoSharing();
    loadFunctions();
    loadTasks().then(() => {
        console.log('Initial state setup complete:', window.state);
    });
    // Initialize function modal
    const functionModal = document.getElementById('functionModal');
    if (functionModal) {
        new bootstrap.Modal(functionModal);
    }

    // Add save function button handler
    if (saveFunctionBtn) {
        saveFunctionBtn.addEventListener('click', saveFunction);
    }
    if (addFunctionTapBtn) addFunctionTapBtn.addEventListener('click', () => addBlockToFunction('tap'));
    if (addFunctionLoopBtn) addFunctionLoopBtn.addEventListener('click', () => addBlockToFunction('loop'));
});

// Make functions available globally
window.processBlocks = function(blocks) {
    console.log('Processing blocks in simulator:', blocks);
    if (!window.state.currentTask) {
        console.error('No active task available');
        return false;
    }

    try {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                addLoopBlock(block.iterations, block.blocks);
            } else if (block.type === 'tap') {
                addTapBlock(null, block.region);
            }
        });
        updateTaskDisplay();
        scheduleAutosave();
        return true;
    } catch (error) {
        console.error('Error processing blocks:', error);
        return false;
    }
};

// Task Management
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to load tasks');

        state.tasks = await response.json();
        updateTaskList();

        if (state.tasks.length > 0) {
            let taskToLoad;

            // Try to load last opened task
            if (state.lastTaskId) {
                taskToLoad = state.tasks.find(t => t.id === parseInt(state.lastTaskId));
            }

            // If no last task or it doesn't exist, load most recent
            if (!taskToLoad) {
                taskToLoad = state.tasks.reduce((latest, current) => {
                    const latestDate = new Date(latest.updated_at);
                    const currentDate = new Date(current.updated_at);
                    return currentDate > latestDate ? current : latest;
                }, state.tasks[0]);
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

// Update createNewTask function to properly handle task creation and state updates
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

        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `Task ${nextNumber}`
            })
        });

        if (!response.ok) throw new Error('Failed to create task');

        const task = await response.json();

        // Update state with the new task
        state.tasks.push(task);

        // Set the new task as current
        state.currentTask = {
            id: task.id,
            blocks: []
        };

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

// Add autosave before loading new task
async function loadTask(taskId) {
    try {
        // Save current task before loading new one
        if (state.currentTask) {
            await saveCurrentTask();
        }

        const response = await fetch(`/api/tasks/${taskId}/blocks`);
        if (!response.ok) throw new Error('Failed to load task blocks');

        const blocks = await response.json();
        state.currentTask = {
            id: taskId,
            blocks: blocks.map(block => {
                // Ensure all properties are properly loaded
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
                } else if (block.type === 'conditional') {
                    return {
                        ...block,
                        data: {
                            threshold: block.data.threshold || 90,
                            referenceImage: block.data.referenceImage || null,
                            thenBlocks: block.data.thenBlocks || [],
                            elseBlocks: block.data.elseBlocks || []
                        }
                    };
                }
                return block;
            })
        };

        updateTaskDisplay();
    } catch (error) {
        console.error('Error loading task:', error);
        logToConsole('Error loading task', 'error');
    }
}