import { IFCViewer } from "./viewer";
import { setupToolbar } from "./toolbar";

declare global {
  interface Window {
    __WASM_PATH__: string;
  }
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

let viewer: IFCViewer | null = null;

async function init(): Promise<void> {
  const viewport = document.getElementById("viewport")!;

  viewer = new IFCViewer(viewport, window.__WASM_PATH__);
  await viewer.init();

  setupToolbar(viewer);

  vscode.postMessage({ type: "ready" });
}

window.addEventListener("message", async (event) => {
  const message = event.data;

  switch (message.type) {
    case "loadFile": {
      const loadingText = document.getElementById("loading-text");
      if (loadingText) {
        loadingText.textContent = "Loading IFC model...";
      }

      try {
        const data = new Uint8Array(message.data);
        if (viewer) {
          const info = await viewer.loadIFC(data);
          updateInfoPanel(info, message.fileName);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error loading file";
        vscode.postMessage({ type: "error", message: errorMessage });
        if (loadingText) {
          loadingText.textContent = `Error: ${errorMessage}`;
        }
      }
      break;
    }
    case "resetCamera":
      viewer?.resetCamera();
      break;
    case "toggleWireframe":
      viewer?.toggleWireframe();
      break;
    case "fitToView":
      viewer?.fitToView();
      break;
  }
});

function updateInfoPanel(
  info: { elementCount: number } | null,
  fileName: string
): void {
  const panel = document.getElementById("info-panel");
  const elementsEl = document.getElementById("info-elements");
  const fileEl = document.getElementById("info-file");

  if (panel && info) {
    panel.style.display = "block";
    if (elementsEl) {
      elementsEl.textContent = info.elementCount.toLocaleString();
    }
    if (fileEl) {
      const parts = fileName.replace(/\\/g, "/").split("/");
      fileEl.textContent = parts[parts.length - 1] || fileName;
    }
  }
}

init().catch((err) => {
  console.error("OpenCAD: Failed to initialize viewer", err);
  vscode.postMessage({
    type: "error",
    message: "Failed to initialize 3D viewer",
  });
});
