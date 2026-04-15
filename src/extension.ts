import * as vscode from "vscode";
import { IFCEditorProvider } from "./ifcEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new IFCEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      IFCEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("opencad.openViewer", async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          "IFC Files": ["ifc"],
          "All CAD Files": ["ifc"],
        },
        title: "Open CAD File",
      });

      if (uri && uri[0]) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri[0],
          IFCEditorProvider.viewType
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("opencad.resetCamera", () => {
      vscode.commands.executeCommand("opencad.internal.postMessage", {
        type: "resetCamera",
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("opencad.toggleWireframe", () => {
      vscode.commands.executeCommand("opencad.internal.postMessage", {
        type: "toggleWireframe",
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("opencad.fitToView", () => {
      vscode.commands.executeCommand("opencad.internal.postMessage", {
        type: "fitToView",
      });
    })
  );
}

export function deactivate(): void {
  // Clean up resources if needed
}
