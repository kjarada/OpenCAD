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

const DEFAULT_LINE_COLOR = new THREE.Color(0xcccccc);
const DEFAULT_FILL_COLOR = new THREE.Color(0x6699cc);
const CIRCLE_SEGMENTS = 64;

function toThreeColor(color?: Color): THREE.Color {
  if (!color) {
    return DEFAULT_LINE_COLOR.clone();
  }
  return new THREE.Color(color.r, color.g, color.b);
}

function toOpacity(color?: Color): number {
  return color ? color.a : 1.0;
}

function getLineMaterial(color?: Color): THREE.LineBasicMaterial {
  const opacity = toOpacity(color);
  return new THREE.LineBasicMaterial({
    color: toThreeColor(color),
    transparent: opacity < 1.0,
    opacity,
  });
}

function getMeshMaterial(color?: Color): THREE.MeshStandardMaterial {
  const fillColor = color ? toThreeColor(color) : DEFAULT_FILL_COLOR.clone();
  const opacity = toOpacity(color);
  return new THREE.MeshStandardMaterial({
    color: fillColor,
    side: THREE.DoubleSide,
    transparent: opacity < 1.0,
    opacity,
  });
}

function buildLine(entity: LineEntity): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(entity.start.x, entity.start.y, entity.start.z),
    new THREE.Vector3(entity.end.x, entity.end.y, entity.end.z),
  ]);
  return new THREE.Line(geometry, getLineMaterial(entity.color));
}

function buildPolyline(entity: PolylineEntity): THREE.Line | THREE.LineLoop {
  const points = entity.points.map(
    (p) => new THREE.Vector3(p.x, p.y, p.z)
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = getLineMaterial(entity.color);

  if (entity.closed) {
    return new THREE.LineLoop(geometry, material);
  }
  return new THREE.Line(geometry, material);
}

function buildPolygon(entity: PolygonEntity): THREE.Object3D {
  if (entity.rings.length === 0) {
    return new THREE.Group();
  }

  const outerRing = entity.rings[0];
  if (outerRing.length < 3) {
    return new THREE.Group();
  }

  // Create a 2D shape from the outer ring (project to XZ plane for shapes)
  // Determine primary plane by checking if geometry is more XY, XZ, or YZ
  const shape = new THREE.Shape();
  shape.moveTo(outerRing[0].x, outerRing[0].z);
  for (let i = 1; i < outerRing.length; i++) {
    shape.lineTo(outerRing[i].x, outerRing[i].z);
  }
  shape.closePath();

  // Add holes
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

  const material = getMeshMaterial(entity.color);
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
  // ShapeGeometry creates geometry in XY; rotate to XZ plane
  mesh.rotation.x = -Math.PI / 2;

  return mesh;
}

function buildCircle(entity: CircleEntity): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        entity.center.x + Math.cos(angle) * entity.radius,
        entity.center.y,
        entity.center.z + Math.sin(angle) * entity.radius
      )
    );
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geometry, getLineMaterial(entity.color));
}

function buildArc(entity: ArcEntity): THREE.Line {
  const points: THREE.Vector3[] = [];
  const startAngle = entity.startAngle;
  let endAngle = entity.endAngle;

  // Ensure we go in the positive direction
  if (endAngle < startAngle) {
    endAngle += Math.PI * 2;
  }

  const segments = Math.max(
    8,
    Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * CIRCLE_SEGMENTS)
  );

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + t * (endAngle - startAngle);
    points.push(
      new THREE.Vector3(
        entity.center.x + Math.cos(angle) * entity.radius,
        entity.center.y,
        entity.center.z + Math.sin(angle) * entity.radius
      )
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, getLineMaterial(entity.color));
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

  // Re-set font after canvas resize clears it
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

  // Scale based on text height
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(entity.height * aspect, entity.height, 1);

  if (entity.rotation) {
    sprite.material.rotation = entity.rotation;
  }

  return sprite;
}

function buildMesh(entity: MeshEntity): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(entity.vertices, 3)
  );

  if (entity.indices.length > 0) {
    geometry.setIndex(entity.indices);
  }

  if (entity.normals && entity.normals.length > 0) {
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(entity.normals, 3)
    );
  } else {
    geometry.computeVertexNormals();
  }

  return new THREE.Mesh(geometry, getMeshMaterial(entity.color));
}

function buildEntity(entity: GeometryEntity): THREE.Object3D {
  switch (entity.kind) {
    case "line":
      return buildLine(entity);
    case "polyline":
      return buildPolyline(entity);
    case "polygon":
      return buildPolygon(entity);
    case "circle":
      return buildCircle(entity);
    case "arc":
      return buildArc(entity);
    case "text":
      return buildText(entity);
    case "mesh":
      return buildMesh(entity);
  }
}

export function buildGeometry(data: GeometryData): GeometryRenderResult {
  const root = new THREE.Group();
  const layerGroups = new Map<string, THREE.Group>();
  let elementCount = 0;

  // Create layer groups
  for (const layerInfo of data.layers) {
    const group = new THREE.Group();
    group.name = layerInfo.name;
    group.visible = layerInfo.visible;
    layerGroups.set(layerInfo.name, group);
    root.add(group);
  }

  // Default layer for entities without a layer assignment
  const defaultLayer = new THREE.Group();
  defaultLayer.name = "__default__";
  root.add(defaultLayer);

  for (const entity of data.entities) {
    const obj = buildEntity(entity);
    elementCount++;

    const layerName = "layer" in entity ? (entity.layer ?? "") : "";
    const targetGroup = layerGroups.get(layerName) ?? defaultLayer;
    targetGroup.add(obj);
  }

  return { group: root, elementCount, layers: layerGroups };
}
