function addTapBlock(parent) {
    const tapBlock = {
        type: 'tap',
        region: null,
        name: 'Tap Block'
    };
    parent.blocks.push(tapBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block tap-block';
    blockDiv.draggable = true;
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name" contenteditable="true">${tapBlock.name}</h6>
        </div>
    `;

    setupDragAndDrop(blockDiv);

    blockDiv.querySelector('.delete-dot').addEventListener('click', () => {
        const index = parent.blocks.indexOf(tapBlock);
        if (index > -1) {
            parent.blocks.splice(index, 1);
            blockDiv.remove();
            logLiveConsole('Tap block removed', 'info');
        }
    });

    // Click handler for the whole block to enable drawing mode
    blockDiv.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-dot')) {
            setBlockFocus(tapBlock, blockDiv);
            enableDrawingMode(tapBlock, blockDiv);
        }
    });

    // Auto-focus new tap block
    setTimeout(() => {
        setBlockFocus(tapBlock, blockDiv);
        enableDrawingMode(tapBlock, blockDiv);
    }, 0);

    return blockDiv;
}

function addLoopBlock(parent) {
    const loopBlock = {
        type: 'loop',
        iterations: 1,
        blocks: [],
        name: 'Loop Block'
    };
    parent.blocks.push(loopBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block loop-block';
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="block-name" contenteditable="true">${loopBlock.name}</h6>
        </div>
        <div class="input-group mb-2">
            <span class="input-group-text">Iterations</span>
            <input type="number" class="form-control iterations-input" value="1" min="1">
        </div>
        <div class="nested-blocks"></div>
        <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-primary add-tap-btn">Add Tap</button>
            <button class="btn btn-sm btn-outline-info add-print-btn">Add Print</button>
        </div>
    `;

    blockDiv.querySelector('.delete-dot').addEventListener('click', () => {
        const index = parent.blocks.indexOf(loopBlock);
        if (index > -1) {
            parent.blocks.splice(index, 1);
            blockDiv.remove();
            logLiveConsole('Loop block removed', 'info');
        }
    });

    blockDiv.querySelector('.iterations-input').addEventListener('change', (e) => {
        loopBlock.iterations = parseInt(e.target.value) || 1;
    });

    blockDiv.querySelector('.add-tap-btn').addEventListener('click', () => {
        const tapDiv = addTapBlock(loopBlock);
        blockDiv.querySelector('.nested-blocks').appendChild(tapDiv);
    });

    blockDiv.querySelector('.add-print-btn').addEventListener('click', () => {
        const printDiv = addPrintBlock(loopBlock);
        blockDiv.querySelector('.nested-blocks').appendChild(printDiv);
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
            <input type="text" class="form-control message-input" placeholder="Enter message">
        </div>
    `;

    setupDragAndDrop(blockDiv);

    blockDiv.querySelector('.message-input').addEventListener('input', (e) => {
        printBlock.message = e.target.value;
        logLiveConsole(`Print: ${e.target.value}`, 'print');
    });

    blockDiv.addEventListener('click', () => {
        setBlockFocus(printBlock, blockDiv);
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