import type { GeometryData } from "./geometry";

/** Messages sent from the extension host to the webview */
export type ExtensionToWebviewMessage =
  | { type: "loadGlb"; data: number[]; fileName: string }
  | { type: "loadGeometry"; data: GeometryData; fileName: string }
  | { type: "conversionError"; message: string }
  | { type: "resetCamera" }
  | { type: "toggleWireframe" }
  | { type: "fitToView" };

/** Messages sent from the webview to the extension host */
export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "info"; message: string }
  | { type: "modelInfo"; [key: string]: unknown };
