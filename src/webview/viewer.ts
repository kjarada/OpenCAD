import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from "web-ifc-three";

export interface ModelInfo {
  elementCount: number;
}

export class IFCViewer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  private grid: THREE.GridHelper | null = null;
  private axes: THREE.AxesHelper | null = null;
  private ifcLoader: IFCLoader | null = null;
  private model: THREE.Object3D | null = null;
  private wireframeMode = false;
  private wasmPath: string;

  constructor(container: HTMLElement, wasmPath: string) {
    this.container = container;
    this.wasmPath = wasmPath;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e2e);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 5000;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => this.onResize());
    resizeObserver.observe(container);

    // Start render loop
    this.animate();
  }

  async init(): Promise<void> {
    this.setupLights();
    this.setupGrid();
    this.setupAxes();
    await this.setupIFCLoader();
  }

  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // Directional light (sun-like)
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(50, 50, 50);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 500;
    directional.shadow.camera.left = -100;
    directional.shadow.camera.right = 100;
    directional.shadow.camera.top = 100;
    directional.shadow.camera.bottom = -100;
    this.scene.add(directional);

    // Fill light
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-30, 20, -30);
    this.scene.add(fill);

    // Hemisphere light for sky/ground ambient
    const hemisphere = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3);
    this.scene.add(hemisphere);
  }

  private setupGrid(): void {
    this.grid = new THREE.GridHelper(100, 100, 0x444444, 0x333333);
    this.grid.material.opacity = 0.3;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);
  }

  private setupAxes(): void {
    this.axes = new THREE.AxesHelper(5);
    this.scene.add(this.axes);
  }

  private async setupIFCLoader(): Promise<void> {
    this.ifcLoader = new IFCLoader();
    // Use absolute path so web-ifc's locateFile returns the full webview URI directly
    const api = this.ifcLoader.ifcManager.state.api as unknown as {
      SetWasmPath(path: string, absolute?: boolean): void;
    };
    api.SetWasmPath(this.wasmPath + "/", true);
  }

  async loadIFC(data: Uint8Array): Promise<ModelInfo> {
    if (!this.ifcLoader) {
      throw new Error("IFC loader not initialized");
    }

    // Remove previous model
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    // Create a blob URL from the data
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    try {
      const model = await new Promise<THREE.Object3D>((resolve, reject) => {
        this.ifcLoader!.load(
          url,
          (m) => resolve(m),
          undefined,
          (err) => reject(err)
        );
      });

      this.model = model;
      this.scene.add(model);

      // Count elements
      let elementCount = 0;
      model.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          elementCount++;
          (child as THREE.Mesh).castShadow = true;
          (child as THREE.Mesh).receiveShadow = true;
        }
      });

      // Fit camera to model
      this.fitToView();

      // Hide loading overlay
      const overlay = document.getElementById("loading-overlay");
      if (overlay) {
        overlay.classList.add("hidden");
      }

      return { elementCount };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  fitToView(): void {
    if (!this.model) {
      return;
    }

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = maxDim / (2 * Math.tan(fov / 2));

    this.camera.position.set(
      center.x + distance * 0.8,
      center.y + distance * 0.6,
      center.z + distance * 0.8
    );
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  resetCamera(): void {
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  toggleWireframe(): void {
    this.wireframeMode = !this.wireframeMode;

    if (this.model) {
      this.model.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              (mat as THREE.MeshStandardMaterial).wireframe = this.wireframeMode;
            });
          } else {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = this.wireframeMode;
          }
        }
      });
    }
  }

  toggleProjection(): void {
    // Toggle between perspective and orthographic (simplified)
    const target = this.controls.target.clone();
    const position = this.camera.position.clone();

    this.camera.position.copy(position);
    this.camera.lookAt(target);
    this.controls.target.copy(target);
    this.controls.update();
  }

  toggleGrid(): void {
    if (this.grid) {
      this.grid.visible = !this.grid.visible;
    }
  }

  toggleAxes(): void {
    if (this.axes) {
      this.axes.visible = !this.axes.visible;
    }
  }

  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.renderer.dispose();
    this.controls.dispose();
    if (this.model) {
      this.scene.remove(this.model);
    }
  }
}
