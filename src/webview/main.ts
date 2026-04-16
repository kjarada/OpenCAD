import { IFCViewer } from "./viewer";
import { setupToolbar } from "./toolbar";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

function wlog(msg: string): void {
  vscode.postMessage({ type: "log", message: msg });
}

let viewer: IFCViewer | null = null;

async function init(): Promise<void> {
  wlog("init() starting...");
  const viewport = document.getElementById("viewport")!;

  viewer = new IFCViewer(viewport);
  await viewer.init();
  wlog("viewer initialized");

  setupToolbar(viewer);
  wlog("toolbar set up, sending ready");

  vscode.postMessage({ type: "ready" });
}

window.addEventListener("message", async (event) => {
  const message = event.data;
  wlog(`message received: type=${message.type}`);

  switch (message.type) {
    case "loadGlb": {
      const loadingText = document.getElementById("loading-text");
      if (loadingText) {
        loadingText.textContent = "Loading model...";
      }

      try {
        const data = new Uint8Array(message.data);
        wlog(`loadGlb: ${data.length} bytes`);
        if (viewer) {
          const info = await viewer.loadGlb(data);
          wlog(`loadGlb done: ${info.elementCount} elements`);
          updateInfoPanel(info, message.fileName);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error loading file";
        wlog(`loadGlb ERROR: ${errorMessage}`);
        vscode.postMessage({ type: "error", message: errorMessage });
        if (loadingText) {
          loadingText.textContent = `Error: ${errorMessage}`;
        }
      }
      break;
    }
    case "loadGeometry": {
      const loadingText = document.getElementById("loading-text");
      if (loadingText) {
        loadingText.textContent = "Rendering geometry...";
      }

      try {
        wlog(`loadGeometry: ${message.data?.entities?.length ?? "?"} entities, coordinateSystem=${message.data?.coordinateSystem ?? "?"}`);
        if (viewer) {
          const info = await viewer.loadGeometry(message.data);
          wlog(`loadGeometry done: ${info.elementCount} elements rendered`);
          updateInfoPanel(info, message.fileName);
        } else {
          wlog("loadGeometry: viewer is null!");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error loading geometry";
        const stack = err instanceof Error ? err.stack : "";
        wlog(`loadGeometry ERROR: ${errorMessage}\n${stack}`);
        vscode.postMessage({ type: "error", message: errorMessage });
        if (loadingText) {
          loadingText.textContent = `Error: ${errorMessage}`;
        }
      }
      break;
    }
    case "conversionError": {
      wlog(`conversionError: ${message.message}`);
      const loadingText = document.getElementById("loading-text");
      if (loadingText) {
        loadingText.textContent = `Conversion failed: ${message.message}`;
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
  const msg = err instanceof Error ? err.message : String(err);
  wlog(`init ERROR: ${msg}`);
  console.error("OpenCAD: Failed to initialize viewer", err);
  vscode.postMessage({
    type: "error",
    message: "Failed to initialize 3D viewer",
  });
});
