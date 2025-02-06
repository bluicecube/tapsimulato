function executeSelectedTask() {
    if (!currentTask) {
        logLiveConsole('No task selected', 'error');
        return;
    }
    
    const gcode = generateGCode();
    simulateExecution(gcode);
}

function generateGCode() {
    if (!currentTask) return '';
    
    let gcode = '';
    for (const block of currentTask.blocks) {
        gcode += generateStepGCode(block);
    }
    
    logLiveConsole('G-code generated', 'success');
    return gcode;
}

function generateStepGCode(step) {
    let gcode = '';
    
    switch (step.type) {
        case 'tap':
            if (step.region) {
                const centerX = (step.region.x1 + step.region.x2) / 2;
                const centerY = (step.region.y1 + step.region.y2) / 2;
                gcode += `G0 X${centerX.toFixed(2)} Y${centerY.toFixed(2)}\n`;
                gcode += `M400 ; Wait for movement completion\n`;
                gcode += `M25 ; Tap at position\n`;
            }
            break;
            
        case 'loop':
            for (let i = 0; i < step.iterations; i++) {
                gcode += `; Loop iteration ${i + 1}/${step.iterations}\n`;
                for (const block of step.blocks) {
                    gcode += generateStepGCode(block);
                }
            }
            break;
            
        case 'print':
            gcode += `; ${step.message}\n`;
            break;
    }
    
    return gcode;
}

function simulateExecution(gcode) {
    const lines = gcode.split('\n');
    let currentLine = 0;
    
    function executeNextLine() {
        if (currentLine >= lines.length) {
            logLiveConsole('Execution completed', 'success');
            return;
        }
        
        const line = lines[currentLine].trim();
        if (line && !line.startsWith(';')) {
            if (line.startsWith('G0')) {
                const match = line.match(/X([\d.]+)\s*Y([\d.]+)/);
                if (match) {
                    simulateTap(parseFloat(match[1]), parseFloat(match[2]));
                }
            }
            logLiveConsole(`Executing: ${line}`, 'info');
        }
        
        currentLine++;
        setTimeout(executeNextLine, 500);
    }
    
    executeNextLine();
}

function simulateTap(x, y) {
    const simulator = document.getElementById('simulator');
    const tapIndicator = document.createElement('div');
    tapIndicator.style.position = 'absolute';
    tapIndicator.style.left = `${x}px`;
    tapIndicator.style.top = `${y}px`;
    tapIndicator.style.width = '20px';
    tapIndicator.style.height = '20px';
    tapIndicator.style.borderRadius = '50%';
    tapIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
    tapIndicator.style.transform = 'translate(-50%, -50%)';
    
    simulator.appendChild(tapIndicator);
    
    setTimeout(() => {
        tapIndicator.remove();
    }, 300);
}
