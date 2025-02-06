function addTapBlock(parent) {
    const tapBlock = {
        type: 'tap',
        region: null
    };
    parent.blocks.push(tapBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block tap-block';
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <h6>Tap Block</h6>
        <button class="btn btn-sm btn-outline-primary select-region-btn">Select Region</button>
    `;

    blockDiv.querySelector('.delete-dot').addEventListener('click', () => {
        const index = parent.blocks.indexOf(tapBlock);
        if (index > -1) {
            parent.blocks.splice(index, 1);
            blockDiv.remove();
            logLiveConsole('Tap block removed', 'info');
        }
    });

    blockDiv.querySelector('.select-region-btn').addEventListener('click', () => {
        enableDrawingMode(tapBlock, blockDiv);
    });

    return blockDiv;
}

function addLoopBlock(parent) {
    const loopBlock = {
        type: 'loop',
        iterations: 1,
        blocks: []
    };
    parent.blocks.push(loopBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block loop-block';
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <h6>Loop Block</h6>
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
        message: ''
    };
    parent.blocks.push(printBlock);

    const blockDiv = document.createElement('div');
    blockDiv.className = 'block print-block';
    blockDiv.innerHTML = `
        <div class="delete-dot"></div>
        <h6>Print Block</h6>
        <div class="input-group">
            <span class="input-group-text">Message</span>
            <input type="text" class="form-control message-input" placeholder="Enter message">
        </div>
    `;

    blockDiv.querySelector('.delete-dot').addEventListener('click', () => {
        const index = parent.blocks.indexOf(printBlock);
        if (index > -1) {
            parent.blocks.splice(index, 1);
            blockDiv.remove();
            logLiveConsole('Print block removed', 'info');
        }
    });

    blockDiv.querySelector('.message-input').addEventListener('input', (e) => {
        printBlock.message = e.target.value;
    });

    return blockDiv;
}

function enableDrawingMode(tapBlock, tapDiv) {
    if (currentTapBlock) {
        disableDrawingMode();
    }
    currentTapBlock = tapBlock;
    tapDiv.classList.add('active-block');
    logLiveConsole('Drawing mode enabled - Select tap region', 'info');
}

function disableDrawingMode() {
    if (currentTapBlock) {
        const activeBlock = document.querySelector('.active-block');
        if (activeBlock) {
            activeBlock.classList.remove('active-block');
        }
        currentTapBlock = null;
        selectionRectangle.classList.add('d-none');
    }
}

// Event listeners for drawing mode
document.addEventListener('click', (e) => {
    if (!e.target.closest('.tap-block') && currentTapBlock) {
        disableDrawingMode();
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && currentTapBlock) {
        disableDrawingMode();
    }
});