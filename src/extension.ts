import * as vscode from 'vscode';
import * as cp from "child_process";
import * as fs from "fs";
import { Eta } from "eta"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('niksi.new', () => {
      NiksiPanel.createOrShow(context.extensionUri, 'new');
    }),
    vscode.commands.registerCommand('niksi.open', () => {
      NiksiPanel.createOrShow(context.extensionUri, 'open');
    }),
    vscode.commands.registerCommand('niksi.aalto', () => {
      NiksiPanel.createOrShow(context.extensionUri, 'aalto');
    }),
    vscode.commands.registerCommand('niksi.import', async () => {
      const repo = await vscode.window.showInputBox({
        placeHolder: "Repository URL",
        prompt: "Import a git repository to Niksi",
      });
      if (repo) {
        await importFromGit(repo, undefined, false);
      }
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

async function importFromGit(repo: string, targetName: string | undefined, ungit: boolean) {
  vscode.window.showInformationMessage(`Cloning ${repo}`)
  cp.exec(`git clone ${repo} C:\\Users\\$ENV:UserName\\niksi\\${targetName ? targetName : ""}`, { "shell": "powershell.exe" })
  // TODO abort if command fails
  if (ungit) {
    const name: string = targetName ? targetName : repo.substring(repo.lastIndexOf("/"), -1)
    cp.exec(`rm -r C:\\Users\\$ENV:UserName\\niksi\\${name}\\.git`, { "shell": "powershell.exe" })
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
  private _page: 'new' | 'open' | 'aalto' = 'new';
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, page: 'new' | 'open' | 'aalto') {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (NiksiPanel.currentPanel) {
      NiksiPanel.currentPanel._panel.reveal(column);
    }

    const panel = NiksiPanel.currentPanel
      ? NiksiPanel.currentPanel._panel
      : vscode.window.createWebviewPanel(
      NiksiPanel.viewType,
      'Niksi',
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri),
    );

    NiksiPanel.currentPanel = new NiksiPanel(panel, extensionUri, page);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    NiksiPanel.currentPanel = new NiksiPanel(panel, extensionUri, 'new');
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, page: 'open' | 'new' | 'aalto') {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._page = page

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
      async message => {
        switch (message.command) {
          case 'select':
            vscode.window.showInformationMessage(message.text + " chosen");
            this.launchProject(message.text);
            return;
          case 'create':
            vscode.window.showInformationMessage("Creating project")
            const project = JSON.parse(message.text)
            await importFromGit("https://github.com/Niksi-tunk/" + project.template + "-template", project.name, true)
            this.launchProject(project.name)
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public launchProject(name: string) {
    cp.exec(`code --remote wsl+nixos "/mnt/c/Users/\$ENV:UserName/niksi/${name}"`, { "shell": "powershell.exe" })
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
    //return fs.readdirSync(`${process.env.HOMEDRIVE}${process.env.HOMEPATH}\\niksi`);
    return ["test1", "test2"]
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = "Niksi"
    this._panel.webview.html = this._getHtmlForWebview(webview, this._page)
  }

  private _getHtmlForWebview(webview: vscode.Webview, page: 'new' | 'open' | 'aalto') {
    const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
    const script = webview.asWebviewUri(scriptPathOnDisk);

    const stylesheetOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css');
    const stylesheet = webview.asWebviewUri(stylesheetOnDisk)

    const templatePath = vscode.Uri.joinPath(this._extensionUri, 'media');
    const eta = new Eta({ views: templatePath.fsPath })

    const projects = this._getProjects();

    const res = eta.render("./" + page, { stylesheet: stylesheet, script: script, projects: projects });
    return res;
  }
}
