// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

const vscode = acquireVsCodeApi();

function buttonHandler(project, action = 'select') {
    vscode.postMessage({
        command: action,
        text: project,
    });
}

function createNew() {
    const data = {
        template: document.getElementById("template").value,
        name: document.getElementById("name").value
    }

    vscode.postMessage({
        command: 'create',
        text: JSON.stringify(data)
    });
}
