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
          "All CAD/GIS Files": [
            "ifc", "dxf", "dwg", "dgn",
            "kml", "kmz", "shp",
            "geojson", "topojson", "gpkg",
            "gml", "gpx", "fgb", "tab", "mif",
          ],
          "IFC Files": ["ifc"],
          "DXF Files": ["dxf"],
          "DWG Files": ["dwg"],
          "DGN Files": ["dgn"],
          "KML/KMZ Files": ["kml", "kmz"],
          "Shapefiles": ["shp"],
          "GeoJSON / TopoJSON": ["geojson", "topojson"],
          "GeoPackage": ["gpkg"],
          "GML": ["gml"],
          "GPX": ["gpx"],
          "FlatGeobuf": ["fgb"],
          "MapInfo": ["tab", "mif"],
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

  // FileGDB is a directory, not a file. VS Code's custom editors require files,
  // so we expose an explicit command wired to explorer context menu on *.gdb folders.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opencad.openGeodatabase",
      async (uri?: vscode.Uri) => {
        let target = uri;
        if (!target) {
          const picks = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "Select File Geodatabase (.gdb folder)",
          });
          if (!picks || picks.length === 0) {return;}
          target = picks[0];
        }
        if (!target.fsPath.toLowerCase().endsWith(".gdb")) {
          vscode.window.showErrorMessage(
            `Not a File Geodatabase folder: ${target.fsPath}`
          );
          return;
        }
        await vscode.commands.executeCommand(
          "vscode.openWith",
          target,
          CADEditorProvider.viewType
        );
      }
    )
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
