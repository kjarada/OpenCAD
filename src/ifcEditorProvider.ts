import * as vscode from "vscode";

export class IFCEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = "opencad.ifcViewer";

  private activeWebviewPanel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.activeWebviewPanel = webviewPanel;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
        vscode.Uri.joinPath(this.context.extensionUri, "assets"),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document.uri
    );

    webviewPanel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message, webviewPanel),
      undefined,
      []
    );

    // Send the file data to the webview
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    webviewPanel.webview.postMessage({
      type: "loadFile",
      data: Array.from(fileData),
      fileName: document.uri.fsPath,
    });

    // Register internal command for posting messages to webview
    const disposable = vscode.commands.registerCommand(
      "opencad.internal.postMessage",
      (msg: unknown) => {
        if (this.activeWebviewPanel) {
          this.activeWebviewPanel.webview.postMessage(msg);
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      disposable.dispose();
      if (this.activeWebviewPanel === webviewPanel) {
        this.activeWebviewPanel = undefined;
      }
    });

    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        this.activeWebviewPanel = webviewPanel;
      }
    });
  }

  private handleMessage(
    message: { type: string; [key: string]: unknown },
    _panel: vscode.WebviewPanel
  ): void {
    switch (message.type) {
      case "ready":
        break;
      case "error":
        vscode.window.showErrorMessage(
          `OpenCAD: ${message.message as string}`
        );
        break;
      case "info":
        vscode.window.showInformationMessage(
          `OpenCAD: ${message.message as string}`
        );
        break;
      case "modelInfo":
        // Could show in a tree view or output channel in the future
        break;
    }
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    _documentUri: vscode.Uri
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview",
        "main.js"
      )
    );

    const wasmUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview"
      )
    );

    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} blob: data:;
    script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' ${webview.cspSource};
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
    connect-src ${webview.cspSource} blob: data:;
    worker-src blob:;
  ">
  <title>OpenCAD Viewer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }
    #viewport {
      width: 100%;
      height: 100%;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    #loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--vscode-editor-background);
      z-index: 100;
      transition: opacity 0.3s ease;
    }
    #loading-overlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--vscode-editor-foreground);
      border-top-color: var(--vscode-focusBorder);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #loading-text {
      margin-top: 16px;
      font-size: 14px;
      opacity: 0.8;
    }
    #toolbar {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 4px;
      z-index: 50;
    }
    .toolbar-btn {
      width: 32px;
      height: 32px;
      border: 1px solid var(--vscode-widget-border, #444);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      opacity: 0.8;
      transition: opacity 0.2s, background 0.2s;
    }
    .toolbar-btn:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }
    #info-panel {
      position: absolute;
      bottom: 12px;
      left: 12px;
      padding: 8px 12px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, #444);
      border-radius: 4px;
      font-size: 12px;
      opacity: 0.8;
      z-index: 50;
      max-width: 300px;
    }
    #info-panel .label {
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="loading-overlay">
      <div class="spinner"></div>
      <div id="loading-text">Loading IFC model...</div>
    </div>
    <div id="toolbar">
      <button class="toolbar-btn" id="btn-fit" title="Fit to View">⊞</button>
      <button class="toolbar-btn" id="btn-wireframe" title="Toggle Wireframe">◻</button>
      <button class="toolbar-btn" id="btn-reset" title="Reset Camera">⟳</button>
      <button class="toolbar-btn" id="btn-ortho" title="Toggle Projection">⊡</button>
    </div>
    <div id="info-panel" style="display:none">
      <div><span class="label">Elements: </span><span id="info-elements">0</span></div>
      <div><span class="label">File: </span><span id="info-file">-</span></div>
    </div>
  </div>
  <script nonce="${nonce}">
    window.__WASM_PATH__ = "${wasmUri}";
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
