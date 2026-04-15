import { IFCViewer } from "./viewer";

export function setupToolbar(viewer: IFCViewer): void {
  const btnFit = document.getElementById("btn-fit");
  const btnWireframe = document.getElementById("btn-wireframe");
  const btnReset = document.getElementById("btn-reset");
  const btnOrtho = document.getElementById("btn-ortho");

  btnFit?.addEventListener("click", () => viewer.fitToView());
  btnWireframe?.addEventListener("click", () => viewer.toggleWireframe());
  btnReset?.addEventListener("click", () => viewer.resetCamera());
  btnOrtho?.addEventListener("click", () => viewer.toggleProjection());
}
