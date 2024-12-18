// Configure Monaco loader
require.config({
    paths: {
        'vs': '../node_modules/monaco-editor/min/vs'
    }
});

let sourceEditor, outputEditor;
let lastValidJson = null; // Store last valid JSON for comparison
let isFolded = false;

// Function to toggle output panel visibility
function toggleOutputPanel(show) {
    const outputPanel = document.getElementById('outputEditor');
    const divider = document.querySelector('.editor-divider');
    const sourcePanel = document.getElementById('sourceEditor');
    
    if (show) {
        outputPanel.classList.remove('hidden');
        divider.classList.remove('hidden');
        sourcePanel.classList.remove('full-width');
    } else {
        outputPanel.classList.add('hidden');
        divider.classList.add('hidden');
        sourcePanel.classList.add('full-width');
    }
    sourceEditor.layout();
    outputEditor.layout();
}

// Function to format JSON with validation
async function formatJsonContent(content, updateSource = true) {
    try {
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        
        if (updateSource) {
            sourceEditor.setValue(formatted);
            lastValidJson = formatted;
        }
        return true;
    } catch (e) {
        console.error('Format error:', e);
        return false;
    }
}

// Function to safely evaluate JavaScript expressions
function safeEval(obj, expression) {
    // Common array methods and properties we want to allow
    const arrayMethods = [
        'map', 'filter', 'reduce', 'forEach', 'some', 'every',
        'find', 'findIndex', 'includes', 'indexOf', 'join',
        'slice', 'sort', 'reverse', 'concat', 'flat', 'flatMap'
    ];

    // Create a secure context with only the methods we want to allow
    const context = {
        Array: {
            isArray: Array.isArray
        },
        Object: {
            keys: Object.keys,
            values: Object.values,
            entries: Object.entries
        },
        JSON: {
            stringify: JSON.stringify,
            parse: JSON.parse
        }
    };

    // Create a proxy to handle property access safely
    function createSecureProxy(target) {
        return new Proxy(target, {
            get(target, prop) {
                const value = target[prop];
                
                // Handle array methods
                if (Array.isArray(target) && arrayMethods.includes(prop)) {
                    return value.bind(target);
                }
                
                // Handle nested objects/arrays
                if (value && typeof value === 'object') {
                    return createSecureProxy(value);
                }
                
                return value;
            }
        });
    }

    try {
        // Process the expression
        let processedExp;
        if (expression.trim().startsWith('.')) {
            processedExp = `this${expression}`; // If starts with dot, prepend this
        } else if (expression.trim().startsWith('[')) {
            processedExp = `this${expression}`; // If starts with bracket, prepend this
        } else {
            processedExp = `this[${expression}]`; // Otherwise wrap in this[]
        }

        // Create the function with our secure context
        const fn = new Function(...Object.keys(context), `
            "use strict";
            const self = this;
            try {
                return ${processedExp};
            } catch (e) {
                throw new Error(\`Error evaluating expression: \${e.message}\`);
            }
        `);

        // Execute the function with our proxy object
        const secureObj = createSecureProxy(obj);
        return fn.apply(secureObj, Object.values(context));
    } catch (e) {
        throw new Error(`Invalid expression: ${e.message}`);
    }
}

// Initialize editors after DOM is loaded
window.onload = function() {
    require(['vs/editor/editor.main'], function() {
        try {
            // Initialize source editor
            sourceEditor = monaco.editor.create(document.getElementById('sourceEditor'), {
                value: '{\n    "example": "Paste your JSON here"\n}',
                language: 'json',
                theme: 'vs-light',
                automaticLayout: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                folding: true,
                foldingStrategy: 'indentation',
                scrollBeyondLastLine: false,
                renderValidationDecorations: 'on',
                readOnly: false,
                contextmenu: true,
                formatOnPaste: false,
                formatOnType: false
            });

            // Initialize output editor
            outputEditor = monaco.editor.create(document.getElementById('outputEditor'), {
                value: '',
                language: 'json',
                theme: 'vs-light',
                automaticLayout: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                folding: true,
                scrollBeyondLastLine: false,
                renderValidationDecorations: 'on',
                readOnly: false,
                contextmenu: true
            });

            // Add paste handler
            sourceEditor.onDidPaste(() => {
                const content = sourceEditor.getValue();
                formatJsonContent(content);
            });

            // Add change handler with debounce
            let formatTimeout = null;
            sourceEditor.onDidChangeModelContent(() => {
                if (formatTimeout) {
                    clearTimeout(formatTimeout);
                }
                formatTimeout = setTimeout(() => {
                    const content = sourceEditor.getValue();
                    if (content !== lastValidJson) {
                        formatJsonContent(content, false);
                    }
                }, 500);
            });

            setupEditorFunctionality();
            toggleOutputPanel(false); // Initially hide output panel
            console.log('Editors initialized successfully');

            // Add this function to check if content is empty (only whitespace)
            function isContentEmpty(content) {
                return !content || /^\s*$/.test(content);
            }

            // Replace the filter input with Monaco editor
            const filterEditor = createFilterEditor();
            
            // Update executeFilter to use the new Monaco editor
            function executeFilter() {
                const filterExp = filterEditor.getValue();
                
                // If filter is empty or only whitespace, hide output panel and return
                if (isContentEmpty(filterExp)) {
                    outputEditor.setValue('');
                    toggleOutputPanel(false);
                    return;
                }

                try {
                    const content = sourceEditor.getValue();
                    const obj = JSON.parse(content);
                    const result = safeEval(obj, filterExp);
                    
                    const formatted = typeof result === 'object' ? 
                        JSON.stringify(result, null, 2) : 
                        String(result);
                        
                    outputEditor.setValue(formatted);
                    toggleOutputPanel(true);
                } catch (e) {
                    console.error('Filter error:', e);
                    outputEditor.setValue(`Error: ${e.message}`);
                    toggleOutputPanel(true);
                }
            }

            // Add keyboard event handler for Enter
            filterEditor.addCommand(monaco.KeyCode.Enter, executeFilter);

            // Update the filter button handler
            window.applyFilter = executeFilter;

            // Import and register custom completions
            // const completionProvider = require('./utils/completionProvider');
            // completionProvider.registerCustomCompletions(filterEditor);

            // Layout editors when window resizes
            window.addEventListener('resize', () => {
                sourceEditor.layout();
                outputEditor.layout();
                filterEditor.layout();
            });

        } catch (error) {
            console.error('Editor initialization error:', error);
        }
    });
};

function setupEditorFunctionality() {
    // Setup resize handler
    const divider = document.querySelector('.editor-divider');
    let isResizing = false;
    
    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            sourceEditor.layout();
            outputEditor.layout();
        }, { once: true });
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const container = document.querySelector('.editor-container');
        const containerRect = container.getBoundingClientRect();
        const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        
        if (percentage > 20 && percentage < 80) {
            document.getElementById('sourceEditor').style.flex = `${percentage}`;
            document.getElementById('outputEditor').style.flex = `${100 - percentage}`;
            sourceEditor.layout();
            outputEditor.layout();
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        sourceEditor.layout();
        outputEditor.layout();
    });
}

// Update format JSON button handler
window.formatJson = async function() {
    const content = sourceEditor.getValue();
    await formatJsonContent(content);
};

// Update other conversion functions to show output panel
window.convertToXml = async function() {
    try {
        const content = sourceEditor.getValue();
        const obj = JSON.parse(content); // First validate JSON
        const xml = await window.electronAPI.convertToXml(content);
        outputEditor.setValue(xml);
        outputEditor.updateOptions({ language: 'xml' }); // Set language mode to XML
        toggleOutputPanel(true);
    } catch (e) {
        console.error('XML conversion error:', e);
        outputEditor.setValue(`Error: ${e.message}`);
        toggleOutputPanel(true);
    }
};

// Update other functions similarly...

window.expandAll = function() {
    try {
        if (isFolded) {
            // If currently folded, unfold all
            sourceEditor.trigger('editor', 'editor.unfoldAll');
        } else {
            // If currently unfolded, fold all
            sourceEditor.trigger('editor', 'editor.foldAll');
        }
        isFolded = !isFolded;
    } catch (e) {
        console.error('Fold/Unfold error:', e);
    }
};

window.convertToTypeScript = async function() {
    try {
        const content = sourceEditor.getValue();
        const obj = JSON.parse(content); // First validate JSON
        const typescript = await window.electronAPI.convertToTypeScript(content);
        outputEditor.setValue(typescript);
        outputEditor.updateOptions({ language: 'typescript' }); // Set language mode to TypeScript
        toggleOutputPanel(true);
    } catch (e) {
        console.error('TypeScript conversion error:', e);
        outputEditor.setValue(`Error: ${e.message}`);
        toggleOutputPanel(true);
    }
};

window.compressAndCopy = function() {
    try {
        const content = sourceEditor.getValue();
        const obj = JSON.parse(content);
        const compressed = JSON.stringify(obj);
        navigator.clipboard.writeText(compressed);
        
        // Show success notification using Monaco's widget
        sourceEditor.trigger('', 'editor.action.showHover', {
            position: { lineNumber: 1, column: 1 },
            focus: false,
            range: new monaco.Range(1, 1, 1, 1)
        });
        
        // Create and show success widget
        const contentWidget = {
            domNode: null,
            getId: function() {
                return 'copy.success.widget';
            },
            getDomNode: function() {
                if (!this.domNode) {
                    this.domNode = document.createElement('div');
                    this.domNode.className = 'monaco-notification-widget success';
                    this.domNode.style.background = '#4CAF50';
                    this.domNode.style.color = 'white';
                    this.domNode.style.padding = '6px 12px';
                    this.domNode.style.borderRadius = '4px';
                    this.domNode.style.position = 'absolute';
                    this.domNode.style.zIndex = '100';
                    this.domNode.innerHTML = '✓ Copied to clipboard';
                }
                return this.domNode;
            },
            getPosition: function() {
                return {
                    position: { lineNumber: 1, column: 1 },
                    preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                };
            }
        };
        
        sourceEditor.addContentWidget(contentWidget);
        setTimeout(() => {
            sourceEditor.removeContentWidget(contentWidget);
        }, 2000);
    } catch (e) {
        // Show error notification
        const errorWidget = {
            // ... similar widget setup but with error styling
            getDomNode: function() {
                if (!this.domNode) {
                    this.domNode = document.createElement('div');
                    this.domNode.className = 'monaco-notification-widget error';
                    this.domNode.style.background = '#f44336';
                    this.domNode.style.color = 'white';
                    this.domNode.style.padding = '6px 12px';
                    this.domNode.style.borderRadius = '4px';
                    this.domNode.style.position = 'absolute';
                    this.domNode.style.zIndex = '100';
                    this.domNode.innerHTML = `Error: ${e.message}`;
                }
                return this.domNode;
            }
        };
        sourceEditor.addContentWidget(errorWidget);
        setTimeout(() => {
            sourceEditor.removeContentWidget(errorWidget);
        }, 3000);
    }
};

// Update the filter input to use Monaco Editor instead of a regular input
function createFilterEditor() {
    const filterContainer = document.getElementById('filterInput').parentElement;
    const monacoContainer = document.createElement('div');
    monacoContainer.style.height = '32px';
    monacoContainer.style.flex = '1';
    monacoContainer.style.width = '100%'; // Ensure container takes full width
    filterContainer.replaceChild(monacoContainer, document.getElementById('filterInput'));

    const filterEditor = monaco.editor.create(monacoContainer, {
        value: '',
        language: 'javascript',
        theme: 'vs-light',
        minimap: { enabled: false },
        scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        wordWrap: 'on',
        contextmenu: false,
        fontSize: 14,
        lineHeight: 32,
        fixedOverflowWidgets: true, // Keep suggestions within viewport
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        snippets: true,
        suggest: {
            showMethods: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showKeywords: true,
            showWords: true,
            showColors: true,
            showFiles: true,
            showReferences: true,
            showFolders: true,
            showTypeParameters: true,
            showSnippets: true
        }
    });

    // Add resize observer to handle editor layout
    const resizeObserver = new ResizeObserver(() => {
        filterEditor.layout();
    });
    resizeObserver.observe(monacoContainer);

    // Add custom completions for array methods with examples
    const methodExamples = {
        filter: [
            { label: 'Filter by property', snippet: 'filter(x => x.${1:property} ${2:>} ${3:value})' },
            { label: 'Filter by type', snippet: 'filter(x => typeof x === "${1:type}")' },
            { label: 'Filter by condition', snippet: 'filter(x => ${1:condition})' }
        ],
        map: [
            { label: 'Map to property', snippet: 'map(x => x.${1:property})' },
            { label: 'Map with transform', snippet: 'map(x => ({ ...x, ${1:newProp}: ${2:value} }))' }
        ],
        reduce: [
            { label: 'Sum values', snippet: 'reduce((sum, x) => sum + x.${1:property}, 0)' },
            { label: 'Group by', snippet: 'reduce((acc, x) => ({ ...acc, [x.${1:key}]: [...(acc[x.${1:key}] || []), x] }), {})' }
        ]
    };

    monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['.'],
        provideCompletionItems: (model, position) => {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });

            const suggestions = [];
            
            // Add method suggestions with examples
            Object.entries(methodExamples).forEach(([method, examples]) => {
                examples.forEach(example => {
                    suggestions.push({
                        label: `${method} - ${example.label}`,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: example.snippet,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: `Array.${method}`,
                        documentation: {
                            value: `Example: \`${example.snippet}\``
                        }
                    });
                });
            });

            return { suggestions };
        }
    });

    return filterEditor;
}

// Add this function
window.loadJsonFile = async function() {
    try {
        const content = await window.electronAPI.loadJsonFile();
        if (content) {
            sourceEditor.setValue(content);
            await formatJsonContent(content);
        }
    } catch (e) {
        // Show error notification
        const errorWidget = {
            domNode: null,
            getId: function() {
                return 'load.error.widget';
            },
            getDomNode: function() {
                if (!this.domNode) {
                    this.domNode = document.createElement('div');
                    this.domNode.className = 'monaco-notification-widget error';
                    this.domNode.style.background = '#f44336';
                    this.domNode.style.color = 'white';
                    this.domNode.style.padding = '6px 12px';
                    this.domNode.style.borderRadius = '4px';
                    this.domNode.style.position = 'absolute';
                    this.domNode.style.zIndex = '100';
                    this.domNode.innerHTML = `Error loading file: ${e.message}`;
                }
                return this.domNode;
            },
            getPosition: function() {
                return {
                    position: { lineNumber: 1, column: 1 },
                    preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                };
            }
        };
        sourceEditor.addContentWidget(errorWidget);
        setTimeout(() => {
            sourceEditor.removeContentWidget(errorWidget);
        }, 3000);
    }
};