// Galaxy A11 dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;
const PHYSICAL_WIDTH = 76.3; // mm
const PHYSICAL_HEIGHT = 161.4; // mm

// Task management state
let currentBlock = null;
let selectionRectangle = null;
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
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

    // Set CSS variables for other components
    document.documentElement.style.setProperty('--device-width', `${DEVICE_WIDTH}px`);
    document.documentElement.style.setProperty('--device-height', `${DEVICE_HEIGHT}px`);

    // Initialize video stream functionality
    const setVideoSourceBtn = document.getElementById('setVideoSource');
    const video = document.getElementById('bgVideo');

    // Add screen capture functionality
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
    // Add Financials navigation
    document.getElementById('financialsLink').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/financials';
    });
});

function executeSelectedTask() {
    const task = window.state && window.state.task;
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
    // Remove focus from previous block if exists
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock.element.classList.remove('active-block');
    }

    // Hide all selection boxes
    document.querySelectorAll('.active-selection-box').forEach(box => {
        box.classList.add('d-none');
    });

    // Set focus on new block
    focusedBlock = { block, element };
    element.classList.add('focused');

    // Show region for tap blocks
    if (block.type === 'tap' && block.region) {
        showSelectionBox(block);
    }
}

function showSelectionBox(tapBlock) {
    if (!tapBlock.region) return;

    // Create a new selection box if one doesn't exist for this tap block
    if (!tapBlock.selectionBoxElement) {
        const newBox = document.createElement('div');
        newBox.className = 'active-selection-box';
        document.getElementById('simulator').appendChild(newBox);
        tapBlock.selectionBoxElement = newBox;
    }

    // Update the position and size
    const selectionBox = tapBlock.selectionBoxElement;
    selectionBox.style.left = `${tapBlock.region.x1}px`;
    selectionBox.style.top = `${tapBlock.region.y1}px`;
    selectionBox.style.width = `${tapBlock.region.x2 - tapBlock.region.x1}px`;
    selectionBox.style.height = `${tapBlock.region.y2 - tapBlock.region.y1}px`;
    selectionBox.classList.remove('d-none');
}

function hideSelectionBox(tapBlock) {
    if (tapBlock.selectionBoxElement) {
        tapBlock.selectionBoxElement.classList.add('d-none');
    }
}

function logLiveConsole(message, type = 'info') {
    const console = document.getElementById('liveConsole');
    const messageDiv = document.createElement('div');
    messageDiv.className = `text-${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
}

function enableDrawingMode(tapBlock, tapDiv) {
    // Clear any existing focus first
    if (focusedBlock && focusedBlock.element !== tapDiv) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock.element.classList.remove('active-block');
    }

    // Hide all other selection boxes first
    document.querySelectorAll('.active-selection-box').forEach(box => {
        box.classList.add('d-none');
    });

    currentBlock = tapBlock;
    tapDiv.classList.add('active-block');
    setBlockFocus(tapBlock, tapDiv);
    logLiveConsole('Drawing mode enabled - Select tap region', 'info');
}

function disableDrawingMode() {
    const activeBlock = document.querySelector('.active-block');
    if (activeBlock) {
        activeBlock.classList.remove('active-block');
    }
    currentBlock = null;

    // Also clear focus when disabling drawing mode
    if (focusedBlock) {
        focusedBlock.element.classList.remove('focused');
        focusedBlock = null;
    }
}

// Event listeners for drawing mode
document.addEventListener('click', (e) => {
    if (!e.target.closest('.block') && currentBlock) {
        disableDrawingMode();
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && currentBlock) {
        disableDrawingMode();
    }
});

// Export functions for external use
window.executeSelectedTask = executeSelectedTask;
window.setBlockFocus = setBlockFocus;
window.showSelectionBox = showSelectionBox;
window.enableDrawingMode = enableDrawingMode;

function generateGCode() {
    if (!window.state || !window.state.task) {
        logLiveConsole("No task selected", "error");
        return;
    }

    let gcode = `; G-code for Samsung Galaxy A11\n`;
    gcode += `; Physical dimensions: ${PHYSICAL_WIDTH}mm x ${PHYSICAL_HEIGHT}mm\n`;
    gcode += `; Screen dimensions: ${DEVICE_WIDTH}px x ${DEVICE_HEIGHT}px\n\n`;
    gcode += `G21 ; Set units to millimeters\n`;
    gcode += `G90 ; Use absolute coordinates\n\n`;

    function convertToPhysical(pixelX, pixelY) {
        // Convert pixel coordinates to physical coordinates (mm)
        const physicalX = (pixelX / DEVICE_WIDTH) * PHYSICAL_WIDTH;
        const physicalY = (pixelY / DEVICE_HEIGHT) * PHYSICAL_HEIGHT;
        return {
            x: Math.max(0, Math.min(PHYSICAL_WIDTH, physicalX)),  // Clamp to physical boundaries
            y: Math.max(0, Math.min(PHYSICAL_HEIGHT, physicalY))
        };
    }

    function processBlocks(blocks, indent = 0) {
        let code = '';
        const indentation = '  '.repeat(indent);

        blocks.forEach(block => {
            if (block.type === 'tap' && block.region) {
                // Calculate center point of the tap region
                const center = {
                    x: (block.region.x1 + block.region.x2) / 2,
                    y: (block.region.y1 + block.region.y2) / 2
                };
                const physical = convertToPhysical(center.x, center.y);

                code += `${indentation}; Tap at pixel coordinates (${Math.round(center.x)}, ${Math.round(center.y)})\n`;
                code += `${indentation}G1 X${physical.x.toFixed(2)} Y${physical.y.toFixed(2)} F1000 ; Move to tap position\n`;
                code += `${indentation}G1 Z0 F500 ; Tap down\n`;
                code += `${indentation}G4 P100 ; Wait 100ms\n`;
                code += `${indentation}G1 Z5 F500 ; Tap up\n`;
                code += `${indentation}G4 P200 ; Wait 200ms between taps\n\n`;
            } else if (block.type === 'loop') {
                code += `${indentation}; Start loop (${block.iterations} iterations)\n`;
                for (let i = 0; i < block.iterations; i++) {
                    code += `${indentation}; Iteration ${i + 1}\n`;
                    code += processBlocks(block.blocks, indent + 1);
                }
                code += `${indentation}; End loop\n\n`;
            }
        });
        return code;
    }

    gcode += processBlocks(window.state.task.blocks);
    logLiveConsole("G-code generated successfully", "success");
    return gcode;
}


// Placeholder functions -  These need actual implementations
function setupDragAndDrop(blockDiv) {}
function simulateTap(x, y) {}

function handleMessage(message) {
    if (!message || !message.command) return;

    switch (message.command) {
        case 'execute':
            if (window.state && window.state.task) {
                executeSelectedTask();
            } else {
                logLiveConsole('No task selected to execute', 'error');
            }
            break;
    }
}