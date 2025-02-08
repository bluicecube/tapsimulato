// Blocks management
function addTapBlock() {
    if (!window.state || !window.state.currentTask) {
        console.error('No active task available');
        return;
    }

    const tapBlock = {
        type: 'tap',
        name: 'Tap Block',
        region: null
    };

    if (!window.state.currentTask.blocks) {
        window.state.currentTask.blocks = [];
    }

    window.state.currentTask.blocks.push(tapBlock);
    if (typeof window.updateTaskDisplay === 'function') {
        window.updateTaskDisplay();
    }
    if (typeof window.scheduleAutosave === 'function') {
        window.scheduleAutosave();
    }
}

function createTapBlockElement(tapBlock) {
    const blockDiv = document.createElement('div');
    blockDiv.className = 'block tap-block';
    blockDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Tap Block</h6>
            <button class="btn btn-sm btn-outline-primary select-region-btn">
                ${tapBlock.region ? 'Change Region' : 'Set Region'}
            </button>
        </div>
        <small class="text-muted">Region: ${tapBlock.region ? JSON.stringify(tapBlock.region) : 'Not set'}</small>
    `;

    blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
        if (typeof window.enableDrawingMode === 'function') {
            window.enableDrawingMode(tapBlock, blockDiv);
        }
    });

    return blockDiv;
}

function addLoopBlock() {
    if (!window.state || !window.state.currentTask) {
        console.error('No active task available');
        return;
    }

    const loopBlock = {
        type: 'loop',
        name: 'Loop Block',
        iterations: 1,
        blocks: []
    };

    if (!window.state.currentTask.blocks) {
        window.state.currentTask.blocks = [];
    }

    window.state.currentTask.blocks.push(loopBlock);
    if (typeof window.updateTaskDisplay === 'function') {
        window.updateTaskDisplay();
    }
    if (typeof window.scheduleAutosave === 'function') {
        window.scheduleAutosave();
    }
}

function createLoopBlockElement(loopBlock) {
    const blockDiv = document.createElement('div');
    blockDiv.className = 'block loop-block';
    blockDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Loop Block</h6>
            <input type="number" class="form-control form-control-sm iterations-input" 
                value="${loopBlock.iterations}" min="1" style="width: 70px">
        </div>
        <div class="nested-blocks mt-2"></div>
    `;

    const iterationsInput = blockDiv.querySelector('.iterations-input');
    iterationsInput.addEventListener('change', (e) => {
        loopBlock.iterations = parseInt(e.target.value) || 1;
        if (typeof window.scheduleAutosave === 'function') {
            window.scheduleAutosave();
        }
    });

    return blockDiv;
}

function addPrintBlock(parent) {
    const printBlock = {
        type: 'print',
        message: '',
        name: 'Print Block'
    };
    parent.blocks.push(printBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block print-block';
    blockDiv.draggable = true;
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name" contenteditable="true">${printBlock.name}</h6>
        </div>
        <div class="input-group">
            <span class="input-group-text">Message</span>
            <input type="text" class="form-control message-input" value="${printBlock.message}" placeholder="Enter message">
        </div>
    `;

    setupDragAndDrop(blockDiv);

    const messageInput = blockDiv.querySelector('.message-input');
    messageInput.addEventListener('input', (e) => {
        printBlock.message = e.target.value;
        console.log('Print block message updated:', printBlock.message); // Debug log
    });

    blockDiv.querySelector('.delete-dot').addEventListener('click', () => {
        const index = parent.blocks.indexOf(printBlock);
        if (index > -1) {
            parent.blocks.splice(index, 1);
            blockDiv.remove();
            logLiveConsole('Print block removed', 'info');
        }
    });

    blockDiv.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-dot')) {
            setBlockFocus(printBlock, blockDiv);
        }
    });

    return blockDiv;
}

function setupDragAndDrop(element) {
    element.addEventListener('dragstart', (e) => {
        e.target.classList.add('dragging');
    });

    element.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
    });

    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        const container = e.target.closest('.blocks-container');

        if (container && draggable) {
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement) {
                container.insertBefore(draggable, afterElement);
            } else {
                container.appendChild(draggable);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.block:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function enableDrawingMode(tapBlock, tapDiv) {
    currentTapBlock = tapBlock;
    tapDiv.classList.add('active-block');
    logLiveConsole('Drawing mode enabled - Select tap region', 'info');
}

function disableDrawingMode() {
    const activeBlock = document.querySelector('.active-block');
    if (activeBlock) {
        activeBlock.classList.remove('active-block');
    }
    currentTapBlock = null;
}

// Event listeners for drawing mode
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && currentTapBlock) {
        disableDrawingMode();
    }
});

// Make functions available globally
window.addTapBlock = addTapBlock;
window.addLoopBlock = addLoopBlock;
window.addPrintBlock = addPrintBlock;