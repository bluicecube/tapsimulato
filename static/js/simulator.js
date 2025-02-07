// Galaxy A11 dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// Selection state
let selectionRectangle = null;
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let currentBlock = null;
let focusedBlock = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize selection box
    selectionRectangle = document.getElementById('selectionBox');
    document.getElementById('executeTaskBtn').addEventListener('click', executeSelectedTask);

    const simulator = document.getElementById('simulator');
    simulator.addEventListener('mousedown', startSelection);
    simulator.addEventListener('mousemove', updateSelection);
    simulator.addEventListener('mouseup', stopSelection);

    // Set simulator size
    simulator.style.width = `${DEVICE_WIDTH}px`;
    simulator.style.height = `${DEVICE_HEIGHT}px`;

    // Initialize manual block building controls
    initializeBlockControls();

    // Initialize video stream functionality
    const setVideoSourceBtn = document.getElementById('setVideoSource');
    const video = document.getElementById('bgVideo');

    setVideoSourceBtn.addEventListener('click', async () => {
        try {
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                },
                audio: false
            });
            video.srcObject = stream;
            logLiveConsole('Screen sharing started successfully', 'success');
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                logLiveConsole('Screen sharing ended', 'info');
                video.srcObject = null;
            });
        } catch (error) {
            logLiveConsole(`Screen sharing error: ${error.message}`, 'error');
            video.srcObject = null;
        }
    });
});

function initializeBlockControls() {
    const blockType = document.getElementById('blockType');
    const tapControls = document.getElementById('tapControls');
    const loopControls = document.getElementById('loopControls');
    const startTapSelect = document.getElementById('startTapSelect');
    const addBlock = document.getElementById('addBlock');

    if (!blockType || !tapControls || !loopControls || !startTapSelect || !addBlock) return;

    // Toggle controls based on block type
    blockType.addEventListener('change', () => {
        if (blockType.value === 'tap') {
            tapControls.style.display = 'block';
            loopControls.style.display = 'none';
        } else {
            tapControls.style.display = 'none';
            loopControls.style.display = 'block';
        }
    });

    // Start tap region selection
    startTapSelect.addEventListener('click', () => {
        currentBlock = { type: 'tap', name: 'Tap Block' };
        logLiveConsole('Select tap region on the simulator', 'info');
    });

    // Add block button handler
    addBlock.addEventListener('click', () => {
        if (!window.state || !window.state.currentTask) {
            logLiveConsole('Please create or select a task first', 'error');
            return;
        }

        if (blockType.value === 'tap') {
            if (!currentBlock || !currentBlock.region) {
                logLiveConsole('Please select a tap region first', 'error');
                return;
            }
            addTapBlock(currentBlock.region);
        } else {
            const iterations = parseInt(document.getElementById('loopIterations').value) || 1;
            addLoopBlock(iterations);
        }
    });
}

function addTapBlock(region) {
    const block = {
        type: 'tap',
        name: 'Tap Block',
        region: region,
        description: `Tap at (${Math.round(region.x1)}, ${Math.round(region.y1)})`
    };

    window.state.currentTask.blocks.push(block);
    updateTaskDisplay();
    currentBlock = null;
    scheduleAutosave();
    logLiveConsole('Tap block added', 'success');
}

function addLoopBlock(iterations) {
    const block = {
        type: 'loop',
        name: 'Loop Block',
        iterations: iterations,
        blocks: []
    };

    window.state.currentTask.blocks.push(block);
    updateTaskDisplay();
    scheduleAutosave();
    logLiveConsole('Loop block added', 'success');
}

function executeSelectedTask() {
    const task = window.state && window.state.currentTask;
    if (!task || !task.blocks || task.blocks.length === 0) {
        logLiveConsole('No blocks to execute', 'error');
        return;
    }

    // Clear any existing focus
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock = null;
    }

    logLiveConsole('Starting task execution', 'info');

    let delay = 0;
    const simulator = document.getElementById('simulator');

    function executeBlocks(blocks) {
        blocks.forEach(block => {
            if (block.type === 'loop') {
                for (let i = 0; i < block.iterations; i++) {
                    executeBlocks(block.blocks);
                }
            } else if (block.type === 'tap' && block.region) {
                delay += Math.random() * 500 + 200; // Random delay between 200-700ms
                setTimeout(() => {
                    // Calculate random point within region
                    const x = block.region.x1 + Math.random() * (block.region.x2 - block.region.x1);
                    const y = block.region.y1 + Math.random() * (block.region.y2 - block.region.y1);

                    // Create visual feedback
                    const feedback = document.createElement('div');
                    feedback.className = 'tap-feedback';
                    feedback.style.left = `${x}px`;
                    feedback.style.top = `${y}px`;

                    simulator.appendChild(feedback);
                    setTimeout(() => feedback.remove(), 500);

                    logLiveConsole(`Tapped at (${Math.round(x)}, ${Math.round(y)})`, 'success');
                }, delay);
            }
        });
    }

    executeBlocks(task.blocks);

    setTimeout(() => {
        logLiveConsole('Task execution completed', 'success');
    }, delay + 500);
}

function startSelection(event) {
    if (!currentBlock) return;

    isSelecting = true;
    const rect = event.target.getBoundingClientRect();
    selectionStartX = event.clientX - rect.left;
    selectionStartY = event.clientY - rect.top;

    selectionRectangle.style.left = `${selectionStartX}px`;
    selectionRectangle.style.top = `${selectionStartY}px`;
    selectionRectangle.style.width = '0';
    selectionRectangle.style.height = '0';
    selectionRectangle.classList.remove('d-none');
}

function updateSelection(event) {
    if (!isSelecting) return;

    const rect = event.target.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const width = currentX - selectionStartX;
    const height = currentY - selectionStartY;

    selectionRectangle.style.width = `${Math.abs(width)}px`;
    selectionRectangle.style.height = `${Math.abs(height)}px`;
    selectionRectangle.style.left = `${width < 0 ? currentX : selectionStartX}px`;
    selectionRectangle.style.top = `${height < 0 ? currentY : selectionStartY}px`;
}

function stopSelection(event) {
    if (!isSelecting) return;

    isSelecting = false;
    const rect = event.target.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    if (currentBlock) {
        currentBlock.region = {
            x1: Math.min(selectionStartX, endX),
            y1: Math.min(selectionStartY, endY),
            x2: Math.max(selectionStartX, endX),
            y2: Math.max(selectionStartY, endY)
        };
        showSelectionBox(currentBlock);
        logLiveConsole('Tap region set', 'success');
    }

    selectionRectangle.classList.add('d-none');
    disableDrawingMode();
}

function setBlockFocus(block, element) {
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
    }
    focusedBlock = { block, element };
    element.classList.add('focused');
    if (block.type === 'tap' && block.region) {
        showSelectionBox(block);
    }
}

function showSelectionBox(tapBlock) {
    if (!tapBlock.region) return;

    // Remove any existing selection boxes
    const existingBoxes = document.querySelectorAll('.active-selection-box');
    existingBoxes.forEach(box => box.remove());

    const selectionBox = document.createElement('div');
    selectionBox.className = 'active-selection-box';
    selectionBox.style.left = `${tapBlock.region.x1}px`;
    selectionBox.style.top = `${tapBlock.region.y1}px`;
    selectionBox.style.width = `${tapBlock.region.x2 - tapBlock.region.x1}px`;
    selectionBox.style.height = `${tapBlock.region.y2 - tapBlock.region.y1}px`;

    const simulator = document.getElementById('simulator');
    simulator.appendChild(selectionBox);
}

function enableDrawingMode(tapBlock, tapDiv) {
    if (focusedBlock && focusedBlock.element !== tapDiv) {
        focusedBlock.element.classList.remove('focused');
    }
    currentBlock = tapBlock;
    tapDiv.classList.add('focused');
    logLiveConsole('Drawing mode enabled - Select tap region', 'info');
}

function disableDrawingMode() {
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock = null;
    }
    currentBlock = null;
}

function logLiveConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageDiv = document.createElement('div');
    messageDiv.className = `text-${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
}

// Export functions for external use
window.executeSelectedTask = executeSelectedTask;
window.setBlockFocus = setBlockFocus;
window.showSelectionBox = showSelectionBox;
window.enableDrawingMode = enableDrawingMode;
window.scheduleAutosave = window.scheduleAutosave || function() { console.warn('scheduleAutosave not loaded'); };
window.addTapBlock = addTapBlock; // Added for external access
window.addLoopBlock = addLoopBlock; // Added for external access
window.initializeBlockControls = initializeBlockControls; //Added for external access