// Define custom block types
Blockly.Blocks['tap_action'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("Tap Region")
            .appendField(new Blockly.FieldButton("Set Region", function() {
                // This will be connected to our region selection system
                window.startTapRegionSelection(this.sourceBlock_);
            }));
        this.setOutput(false);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
        this.setTooltip("Tap a specific region on the screen");
    }
};

Blockly.Blocks['loop'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("Repeat")
            .appendField(new Blockly.FieldNumber(1, 1), "TIMES")
            .appendField("times");
        this.appendStatementInput("DO")
            .appendField("do");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
        this.setTooltip("Repeat actions multiple times");
    }
};

Blockly.Blocks['conditional'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("If screen matches")
            .appendField(new Blockly.FieldButton("Set Reference", function() {
                // This will be connected to our image capture system
                window.captureReferenceImage(this.sourceBlock_);
            }));
        this.appendStatementInput("THEN")
            .appendField("then");
        this.appendStatementInput("ELSE")
            .appendField("else");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
        this.setTooltip("Check if screen matches a reference image");
    }
};

// Code generation
Blockly.JavaScript['tap_action'] = function(block) {
    // Generate code for tap action
    return `{
        type: 'tap',
        region: ${JSON.stringify(block.region || null)}
    },\n`;
};

Blockly.JavaScript['loop'] = function(block) {
    const times = block.getFieldValue('TIMES');
    const branch = Blockly.JavaScript.statementToCode(block, 'DO');
    // Generate code for loop
    return `{
        type: 'loop',
        iterations: ${times},
        blocks: [${branch}]
    },\n`;
};

Blockly.JavaScript['conditional'] = function(block) {
    const thenBranch = Blockly.JavaScript.statementToCode(block, 'THEN');
    const elseBranch = Blockly.JavaScript.statementToCode(block, 'ELSE');
    // Generate code for conditional
    return `{
        type: 'conditional',
        data: {
            referenceImage: ${JSON.stringify(block.referenceImage || null)},
            threshold: ${block.threshold || 90}
        },
        thenBlocks: [${thenBranch}],
        elseBlocks: [${elseBranch}]
    },\n`;
};

// Create a dark theme for Blockly
const darkTheme = Blockly.Theme.defineTheme('dark', {
    'base': Blockly.Themes.Classic,
    'componentStyles': {
        'workspaceBackgroundColour': '#2a2a2a',
        'toolboxBackgroundColour': '#1e1e1e',
        'toolboxForegroundColour': '#fff',
        'flyoutBackgroundColour': '#252526',
        'flyoutForegroundColour': '#ccc',
        'flyoutOpacity': 1,
        'scrollbarColour': '#797979',
        'insertionMarkerColour': '#fff',
        'insertionMarkerOpacity': 0.3,
        'scrollbarOpacity': 0.4,
        'cursorColour': '#d0d0d0',
    }
});

// Initialize Blockly workspace
document.addEventListener('DOMContentLoaded', function() {
    // Main workspace
    const workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        theme: darkTheme, // Use the newly defined dark theme
        grid: {
            spacing: 20,
            length: 3,
            colour: '#ccc',
            snap: true
        },
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
        },
        trashcan: true
    });

    // Function workspace (in modal)
    const functionWorkspace = Blockly.inject('functionBlocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        theme: darkTheme, // Use the newly defined dark theme
        grid: {
            spacing: 20,
            length: 3,
            colour: '#ccc',
            snap: true
        },
        trashcan: true
    });

    // Save workspace state when blocks change
    workspace.addChangeListener(function(event) {
        if (event.type == Blockly.Events.CHANGE ||
            event.type == Blockly.Events.MOVE ||
            event.type == Blockly.Events.DELETE) {
            const code = Blockly.JavaScript.workspaceToCode(workspace);
            window.saveBlocklyState(code);
        }
    });
});