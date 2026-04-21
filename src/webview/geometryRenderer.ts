import * as THREE from "three";
import type {
  GeometryData,
  GeometryEntity,
  Color,
  LineEntity,
  PolylineEntity,
  PolygonEntity,
  CircleEntity,
  ArcEntity,
  TextEntity,
  MeshEntity,
} from "../types/geometry";

export interface GeometryRenderResult {
  group: THREE.Group;
  elementCount: number;
  layers: Map<string, THREE.Group>;
}

const DEFAULT_LINE_COLOR: Color = { r: 0.8, g: 0.8, b: 0.8, a: 1 };
const DEFAULT_FILL_COLOR: Color = { r: 0.4, g: 0.6, b: 0.8, a: 1 };
const CIRCLE_SEGMENTS = 64;

function colorKey(c: Color | undefined, fallback: Color): string {
  const x = c ?? fallback;
  // Quantize to 3 decimal places — avoids cache misses from float noise.
  return `${x.r.toFixed(3)},${x.g.toFixed(3)},${x.b.toFixed(3)},${x.a.toFixed(3)}`;
}

class MaterialCache {
  private lineMats = new Map<string, THREE.LineBasicMaterial>();
  private meshMats = new Map<string, THREE.MeshStandardMaterial>();

  lineMaterial(color?: Color): THREE.LineBasicMaterial {
    const key = colorKey(color, DEFAULT_LINE_COLOR);
    const hit = this.lineMats.get(key);
    if (hit) {
      return hit;
    }
    const c = color ?? DEFAULT_LINE_COLOR;
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(c.r, c.g, c.b),
      transparent: c.a < 1.0,
      opacity: c.a,
    });
    this.lineMats.set(key, mat);
    return mat;
  }

  meshMaterial(color?: Color): THREE.MeshStandardMaterial {
    const key = colorKey(color, DEFAULT_FILL_COLOR);
    const hit = this.meshMats.get(key);
    if (hit) {
      return hit;
    }
    const c = color ?? DEFAULT_FILL_COLOR;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c.r, c.g, c.b),
      side: THREE.DoubleSide,
      transparent: c.a < 1.0,
      opacity: c.a,
    });
    this.meshMats.set(key, mat);
    return mat;
  }
}

/**
 * Accumulates line segment endpoint pairs per color key so we can emit one
 * THREE.LineSegments per color per layer instead of thousands of tiny
 * THREE.Line objects. Each push expects vertex count to be even (pairs of
 * endpoints).
 */
class LineSegmentBatcher {
  private bins = new Map<string, { color?: Color; vertices: number[] }>();

  addSegment(
    color: Color | undefined,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
  ): void {
    const key = colorKey(color, DEFAULT_LINE_COLOR);
    let bin = this.bins.get(key);
    if (!bin) {
      bin = { color, vertices: [] };
      this.bins.set(key, bin);
    }
    bin.vertices.push(ax, ay, az, bx, by, bz);
  }

  addPolyline(color: Color | undefined, points: { x: number; y: number; z: number }[], closed: boolean): void {
    const n = points.length;
    if (n < 2) {
      return;
    }
    const key = colorKey(color, DEFAULT_LINE_COLOR);
    let bin = this.bins.get(key);
    if (!bin) {
      bin = { color, vertices: [] };
      this.bins.set(key, bin);
    }
    const v = bin.vertices;
    // Expand polyline into pairs of consecutive endpoints.
    for (let i = 0; i < n - 1; i++) {
      const p = points[i];
      const q = points[i + 1];
      v.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
    if (closed) {
      const p = points[n - 1];
      const q = points[0];
      v.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }

  flushInto(target: THREE.Object3D, materials: MaterialCache): void {
    for (const bin of this.bins.values()) {
      if (bin.vertices.length === 0) {
        continue;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(bin.vertices), 3),
      );
      target.add(new THREE.LineSegments(geom, materials.lineMaterial(bin.color)));
    }
    this.bins.clear();
  }
}

function buildPolygon(entity: PolygonEntity, materials: MaterialCache): THREE.Object3D | null {
  if (entity.rings.length === 0) {
    return null;
  }

  const outerRing = entity.rings[0];
  if (outerRing.length < 3) {
    return null;
  }

  const shape = new THREE.Shape();
  shape.moveTo(outerRing[0].x, outerRing[0].z);
  for (let i = 1; i < outerRing.length; i++) {
    shape.lineTo(outerRing[i].x, outerRing[i].z);
  }
  shape.closePath();

  for (let h = 1; h < entity.rings.length; h++) {
    const holeRing = entity.rings[h];
    if (holeRing.length < 3) {continue;}
    const holePath = new THREE.Path();
    holePath.moveTo(holeRing[0].x, holeRing[0].z);
    for (let i = 1; i < holeRing.length; i++) {
      holePath.lineTo(holeRing[i].x, holeRing[i].z);
    }
    holePath.closePath();
    shape.holes.push(holePath);
  }

  const material = materials.meshMaterial(entity.color);
  let geometry: THREE.BufferGeometry;
  if (entity.extrudeHeight && entity.extrudeHeight > 0) {
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth: entity.extrudeHeight,
      bevelEnabled: false,
    });
  } else {
    geometry = new THREE.ShapeGeometry(shape);
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function batchCircle(entity: CircleEntity, batcher: LineSegmentBatcher): void {
  const cx = entity.center.x, cy = entity.center.y, cz = entity.center.z;
  const r = entity.radius;
  let prevX = cx + r, prevZ = cz;
  for (let i = 1; i <= CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    batcher.addSegment(entity.color, prevX, cy, prevZ, x, cy, z);
    prevX = x; prevZ = z;
  }
}

function batchArc(entity: ArcEntity, batcher: LineSegmentBatcher): void {
  const cx = entity.center.x, cy = entity.center.y, cz = entity.center.z;
  const r = entity.radius;
  const startAngle = entity.startAngle;
  let endAngle = entity.endAngle;
  if (endAngle < startAngle) {
    endAngle += Math.PI * 2;
  }
  const segments = Math.max(
    8,
    Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * CIRCLE_SEGMENTS),
  );
  let prevX = cx + Math.cos(startAngle) * r;
  let prevZ = cz + Math.sin(startAngle) * r;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + t * (endAngle - startAngle);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    batcher.addSegment(entity.color, prevX, cy, prevZ, x, cy, z);
    prevX = x; prevZ = z;
  }
}

function buildText(entity: TextEntity): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const fontSize = 64;
  ctx.font = `${fontSize}px monospace`;
  const metrics = ctx.measureText(entity.content);
  const textWidth = metrics.width;

  canvas.width = Math.ceil(textWidth) + 4;
  canvas.height = fontSize + 8;

  ctx.font = `${fontSize}px monospace`;
  const color = entity.color
    ? `rgba(${Math.round(entity.color.r * 255)}, ${Math.round(entity.color.g * 255)}, ${Math.round(entity.color.b * 255)}, ${entity.color.a})`
    : "rgba(255, 255, 255, 1)";
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.fillText(entity.content, 2, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.set(entity.position.x, entity.position.y, entity.position.z);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(entity.height * aspect, entity.height, 1);
  if (entity.rotation) {
    sprite.material.rotation = entity.rotation;
  }
  return sprite;
}

function buildMesh(entity: MeshEntity, materials: MaterialCache): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(entity.vertices);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  if (entity.indices.length > 0) {
    // Pick Uint16 when the vertex count fits — halves GPU index memory vs Uint32.
    const vertexCount = positions.length / 3;
    const indexArray =
      vertexCount > 65535
        ? new Uint32Array(entity.indices)
        : new Uint16Array(entity.indices);
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  }

  if (entity.normals && entity.normals.length > 0) {
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(entity.normals), 3),
    );
  } else {
    geometry.computeVertexNormals();
  }

  return new THREE.Mesh(geometry, materials.meshMaterial(entity.color));
}

function addLineEntity(entity: LineEntity, batcher: LineSegmentBatcher): void {
  batcher.addSegment(
    entity.color,
    entity.start.x, entity.start.y, entity.start.z,
    entity.end.x, entity.end.y, entity.end.z,
  );
}

function addPolylineEntity(entity: PolylineEntity, batcher: LineSegmentBatcher): void {
  batcher.addPolyline(entity.color, entity.points, entity.closed);
}

export function buildGeometry(data: GeometryData): GeometryRenderResult {
  const root = new THREE.Group();
  const materials = new MaterialCache();
  const layerGroups = new Map<string, THREE.Group>();
  // One batcher per layer so layer.visible still toggles everything on/off.
  const layerBatchers = new Map<string, LineSegmentBatcher>();
  let elementCount = 0;

  function getLayerTarget(layerName: string): { group: THREE.Group; batcher: LineSegmentBatcher } {
    let group = layerGroups.get(layerName);
    if (!group) {
      // Unknown layer (e.g., entity references layer that wasn't declared).
      // Fall back to default layer rather than creating a hidden one.
      group = layerGroups.get("__default__")!;
    }
    let batcher = layerBatchers.get(group.name);
    if (!batcher) {
      batcher = new LineSegmentBatcher();
      layerBatchers.set(group.name, batcher);
    }
    return { group, batcher };
  }

  for (const layerInfo of data.layers) {
    const group = new THREE.Group();
    group.name = layerInfo.name;
    group.visible = layerInfo.visible;
    layerGroups.set(layerInfo.name, group);
    root.add(group);
  }

  const defaultLayer = new THREE.Group();
  defaultLayer.name = "__default__";
  layerGroups.set("__default__", defaultLayer);
  root.add(defaultLayer);

  for (const entity of data.entities as GeometryEntity[]) {
    const layerName = "layer" in entity ? (entity.layer ?? "__default__") : "__default__";
    const { group, batcher } = getLayerTarget(layerName);
    elementCount++;

    switch (entity.kind) {
      case "line":
        addLineEntity(entity, batcher);
        break;
      case "polyline":
        addPolylineEntity(entity, batcher);
        break;
      case "circle":
        batchCircle(entity, batcher);
        break;
      case "arc":
        batchArc(entity, batcher);
        break;
      case "polygon": {
        const obj = buildPolygon(entity, materials);
        if (obj) {
          group.add(obj);
        }
        break;
      }
      case "text":
        group.add(buildText(entity));
        break;
      case "mesh":
        group.add(buildMesh(entity, materials));
        break;
    }
  }

  // Flush batched lines into each layer group.
  for (const [layerName, batcher] of layerBatchers) {
    const group = layerGroups.get(layerName);
    if (group) {
      batcher.flushInto(group, materials);
    }
  }

  return { group: root, elementCount, layers: layerGroups };
}
