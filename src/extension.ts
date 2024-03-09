import * as vscode from 'vscode';
import * as cp from "child_process";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('niksi.start', () => {
      NiksiPanel.createOrShow(context.extensionUri);
    })
  );

  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(NiksiPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
        console.log(`Got state ${state}`);

        webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
        NiksiPanel.revive(webviewPanel, context.extensionUri);
      }
    });
  }


	const provider = new NiksiViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(NiksiViewProvider.viewType, provider));
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
  };
}

class NiksiPanel {
  public static currentPanel: NiksiPanel | undefined;

  public static readonly viewType = 'Niksi';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (NiksiPanel.currentPanel) {
      NiksiPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      NiksiPanel.viewType,
      'Niksi',
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri),
    );

    NiksiPanel.currentPanel = new NiksiPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    NiksiPanel.currentPanel = new NiksiPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.onDidChangeViewState(
      e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'alert':
            vscode.window.showInformationMessage(message.text + " chosen");
            this.launchProject(message.text);
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public launchProject(name: string) {
    cp.exec(`code --remote wsl+nixos "/mnt/c/Users/\$ENV:UserName/niksi/${name}"`, {"shell": "powershell.exe"})
  }

  public dispose() {
    NiksiPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getProjects() {
    return fs.readdirSync(`${process.env.HOMEDRIVE}${process.env.HOMEPATH}\\niksi`);
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = "Niksi"
    this._panel.webview.html = this._getHtmlForWebview(webview, this._getProjects())
  }

  private _getHtmlForWebview(webview: vscode.Webview, projects: string[]) {
    const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
    const stylePathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

    const stylesResetUri = webview.asWebviewUri(styleResetPath);
    const stylesMainUri = webview.asWebviewUri(stylePathMainPath);

    const nonce = getNonce();

    const buttons = projects.map(p =>
      `<button onClick=buttonHandler('${p}') type="button">
         ${p}</button>`
    ).join('\n')

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<!--<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">-->

				<title>Cat Coding</title>
			</head>
			<body>
        ${buttons}

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}



class NiksiViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'niksi.webview';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) {

  }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		return `
          <html>
          <body>
              <button onclick="onClick()">Click me</button>
          </body>
          </html>
      `;
	}

}
