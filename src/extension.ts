import * as vscode from "vscode";
import { CADEditorProvider } from "./cadEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CADEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      CADEditorProvider.viewType,
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
          "All CAD/GIS Files": ["ifc", "dxf", "dwg", "kml", "kmz", "shp"],
          "IFC Files": ["ifc"],
          "DXF Files": ["dxf"],
          "DWG Files": ["dwg"],
          "KML/KMZ Files": ["kml", "kmz"],
          "Shapefiles": ["shp"],
        },
        title: "Open CAD/GIS File",
      });

      if (uri && uri[0]) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri[0],
          CADEditorProvider.viewType
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
