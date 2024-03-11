import * as vscode from 'vscode';
import * as cp from "child_process";
import * as fs from "fs";
import { Eta } from "eta"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('niksi.new', () => {
      NiksiPanel.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand('niksi.open', () => {
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
          case 'select':
            vscode.window.showInformationMessage(message.text + " chosen");
            this.launchProject(message.text);
            return;
          case 'create':
            vscode.window.showInformationMessage("Would create project")
            // this.createProject(JSON.parse(message.text))
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
    const script = webview.asWebviewUri(scriptPathOnDisk);

    const stylesheetOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css');
    const stylesheet = webview.asWebviewUri(stylesheetOnDisk)

    const templatePath = vscode.Uri.joinPath(this._extensionUri, 'media');
    const eta = new Eta({ views: templatePath.path })

    const res = eta.render("./new", {stylesheet: stylesheet, script: script});
    return res;
	}
}
