import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GeometryData } from "../types/geometry";
import { buildGeometry } from "./geometryRenderer";

export interface ModelInfo {
  elementCount: number;
}

// Scene-size thresholds above which we switch off the expensive-but-pretty stuff.
// Shadow mapping renders the scene twice per frame, which becomes the dominant
// cost on huge CAD/GIS files.
const SHADOW_ELEMENT_LIMIT = 5_000;

export class IFCViewer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  private grid: THREE.GridHelper | null = null;
  private axes: THREE.AxesHelper | null = null;
  private gltfLoader: GLTFLoader;
  private model: THREE.Object3D | null = null;
  private wireframeMode = false;
  private needsRender = true;
  private shadowsEnabled = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.gltfLoader = new GLTFLoader();

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
    // Render-on-demand: only redraw when the camera actually moves.
    this.controls.addEventListener("change", () => {
      this.needsRender = true;
    });

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

  async loadGlb(data: Uint8Array): Promise<ModelInfo> {
    // Remove previous model
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    const buffer = data.buffer instanceof ArrayBuffer
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data.slice().buffer;

    return new Promise<ModelInfo>((resolve, reject) => {
      this.gltfLoader.parse(
        buffer as ArrayBuffer,
        "",
        (gltf) => {
          const modelGroup = gltf.scene;
          let elementCount = 0;
          modelGroup.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
              elementCount++;
            }
          });

          // Decide once whether shadows are affordable. Shadow passes double
          // the cost of each frame; on dense IFC models that's a huge hit.
          this.applyShadowPolicy(elementCount);
          if (this.shadowsEnabled) {
            modelGroup.traverse((child: THREE.Object3D) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });
          }

          this.model = modelGroup;
          this.scene.add(modelGroup);
          this.fitToView();
          this.needsRender = true;

          // Hide loading overlay
          const overlay = document.getElementById("loading-overlay");
          if (overlay) {
            overlay.classList.add("hidden");
          }

          resolve({ elementCount });
        },
        (error) => {
          reject(new Error(`Failed to parse GLB: ${error.message}`));
        }
      );
    });
  }

  async loadGeometry(data: GeometryData): Promise<ModelInfo> {
    // Remove previous model
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    const result = buildGeometry(data);

    this.applyShadowPolicy(result.elementCount);

    this.model = result.group;
    this.scene.add(result.group);

    // Adjust camera clipping planes to fit the geometry scale
    const box = new THREE.Box3().setFromObject(result.group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    this.camera.near = maxDim * 0.0001;
    this.camera.far = maxDim * 20;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = maxDim * 10;

    if (data.coordinateSystem === "geographic") {
      // Top-down view for geographic data
      const center = box.getCenter(new THREE.Vector3());
      const distance = maxDim * 1.2;
      this.camera.position.set(center.x, center.y + distance, center.z + distance * 0.01);
      this.camera.lookAt(center);
      this.controls.target.copy(center);
      this.controls.update();
    } else {
      this.fitToView();
    }

    // Hide loading overlay
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }

    this.needsRender = true;
    return { elementCount: result.elementCount };
  }

  private applyShadowPolicy(elementCount: number): void {
    const enable = elementCount <= SHADOW_ELEMENT_LIMIT;
    if (enable === this.shadowsEnabled) {
      return;
    }
    this.shadowsEnabled = enable;
    this.renderer.shadowMap.enabled = enable;
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
    this.needsRender = true;
  }

  resetCamera(): void {
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.needsRender = true;
  }

  toggleWireframe(): void {
    this.wireframeMode = !this.wireframeMode;

    if (this.model) {
      // Shared materials mean we can flip wireframe once per unique material
      // rather than once per mesh — huge win on merged/batched scenes.
      const seen = new Set<THREE.Material>();
      this.model.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (seen.has(mat)) {continue;}
            seen.add(mat);
            (mat as THREE.MeshStandardMaterial).wireframe = this.wireframeMode;
          }
        }
      });
    }
    this.needsRender = true;
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
      this.needsRender = true;
    }
  }

  toggleAxes(): void {
    if (this.axes) {
      this.axes.visible = !this.axes.visible;
      this.needsRender = true;
    }
  }

  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.needsRender = true;
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    // OrbitControls with damping still interpolates for a few frames after
    // user input stops — calling update() returns true while it's animating.
    const controlsChanged = this.controls.update();
    if (controlsChanged || this.needsRender) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    }
  };

  dispose(): void {
    this.renderer.dispose();
    this.controls.dispose();
    if (this.model) {
      this.scene.remove(this.model);
    }
  }
}
