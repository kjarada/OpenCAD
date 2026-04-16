import * as fs from "fs";
import type { ConversionResult, FormatConverter } from "./converter";
import type {
  GeometryEntity,
  GeometryData,
  LayerInfo,
  Color,
  Point3D,
} from "../types/geometry";

// The dxf package uses CommonJS and has no TypeScript types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dxf = require("dxf");

interface DxfEntity {
  type: string;
  layer?: string;
  colorNumber?: number;
  transforms?: unknown[];
  // LINE
  start?: { x: number; y: number; z?: number };
  end?: { x: number; y: number; z?: number };
  // CIRCLE, ARC
  x?: number;
  y?: number;
  z?: number;
  r?: number;
  startAngle?: number;
  endAngle?: number;
  // LWPOLYLINE / POLYLINE
  vertices?: Array<{ x: number; y: number; z?: number; bulge?: number }>;
  closed?: boolean;
  // TEXT / MTEXT
  string?: string;
  textHeight?: number;
  rotation?: number;
  // 3DFACE
  corners?: Array<{ x: number; y: number; z?: number }>;
  // SPLINE
  controlPoints?: Array<{ x: number; y: number; z?: number }>;
  knots?: number[];
  degree?: number;
  // SOLID
  points?: Array<{ x: number; y: number; z?: number }>;
  // ELLIPSE
  majorX?: number;
  majorY?: number;
  majorZ?: number;
  axisRatio?: number;
}

interface DxfParseResult {
  entities: DxfEntity[];
  blocks: Array<{ name: string; entities: DxfEntity[] }>;
  tables: {
    layers: Record<string, { name: string; colorNumber: number }>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dxfColors: Array<[number, number, number]> = require("dxf/lib/util/colors").default;

function resolveColor(
  entity: DxfEntity,
  layers: Record<string, { colorNumber: number }>
): Color | undefined {
  let colorNumber: number | undefined;

  if (entity.colorNumber !== undefined && entity.colorNumber !== 256) {
    colorNumber = entity.colorNumber;
  } else if (entity.layer && layers[entity.layer]) {
    colorNumber = layers[entity.layer].colorNumber;
  }

  if (colorNumber === undefined || !dxfColors[colorNumber]) {
    return undefined;
  }

  const [r, g, b] = dxfColors[colorNumber];
  return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
}

// DXF uses X-right, Y-forward, Z-up. Three.js uses Y-up.
// Swap Y↔Z so DXF floor plans render horizontally on the XZ ground plane.
function p3d(p: { x: number; y: number; z?: number }): Point3D {
  return { x: p.x, y: p.z ?? 0, z: p.y ?? 0 };
}

function convertEntity(
  entity: DxfEntity,
  layers: Record<string, { colorNumber: number }>
): GeometryEntity | null {
  const color = resolveColor(entity, layers);
  const layer = entity.layer;

  switch (entity.type) {
    case "LINE": {
      if (!entity.start || !entity.end) {return null;}
      return {
        kind: "line",
        start: p3d(entity.start),
        end: p3d(entity.end),
        color,
        layer,
      };
    }

    case "LWPOLYLINE":
    case "POLYLINE": {
      if (!entity.vertices || entity.vertices.length < 2) {return null;}
      return {
        kind: "polyline",
        points: entity.vertices.map(p3d),
        closed: entity.closed ?? false,
        color,
        layer,
      };
    }

    case "CIRCLE": {
      if (entity.x === undefined || entity.y === undefined || !entity.r) {return null;}
      return {
        kind: "circle",
        center: { x: entity.x, y: entity.z ?? 0, z: entity.y },
        radius: entity.r,
        color,
        layer,
      };
    }

    case "ARC": {
      if (
        entity.x === undefined ||
        entity.y === undefined ||
        !entity.r ||
        entity.startAngle === undefined ||
        entity.endAngle === undefined
      ) {return null;}
      return {
        kind: "arc",
        center: { x: entity.x, y: entity.z ?? 0, z: entity.y },
        radius: entity.r,
        startAngle: (entity.startAngle * Math.PI) / 180,
        endAngle: (entity.endAngle * Math.PI) / 180,
        color,
        layer,
      };
    }

    case "TEXT":
    case "MTEXT": {
      if (!entity.string) {return null;}
      return {
        kind: "text",
        position: { x: entity.x ?? 0, y: entity.z ?? 0, z: entity.y ?? 0 },
        content: entity.string,
        height: entity.textHeight ?? 1,
        rotation: entity.rotation ? (entity.rotation * Math.PI) / 180 : undefined,
        color,
        layer,
      };
    }

    case "3DFACE": {
      if (!entity.corners || entity.corners.length < 3) {return null;}
      const corners = entity.corners.map(p3d);
      const vertices: number[] = [];
      const indices: number[] = [];

      for (const c of corners) {
        vertices.push(c.x, c.y, c.z);
      }

      // Triangle fan from first vertex
      for (let i = 1; i < corners.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      return {
        kind: "mesh",
        vertices,
        indices,
        color,
        layer,
      };
    }

    case "SOLID": {
      if (!entity.points || entity.points.length < 3) {return null;}
      const pts = entity.points.map(p3d);
      const verts: number[] = [];
      const idx: number[] = [];

      for (const c of pts) {
        verts.push(c.x, c.y, c.z);
      }

      for (let i = 1; i < pts.length - 1; i++) {
        idx.push(0, i, i + 1);
      }

      return {
        kind: "mesh",
        vertices: verts,
        indices: idx,
        color,
        layer,
      };
    }

    case "POINT": {
      // Render as a tiny circle
      if (entity.x === undefined || entity.y === undefined) {return null;}
      return {
        kind: "circle",
        center: { x: entity.x, y: entity.z ?? 0, z: entity.y },
        radius: 0.1,
        color,
        layer,
      };
    }

    case "ELLIPSE": {
      // Approximate ellipse as polyline
      if (
        entity.x === undefined ||
        entity.y === undefined ||
        entity.majorX === undefined ||
        entity.majorY === undefined
      ) {return null;}

      const cx = entity.x;
      const cy = entity.y;
      const cz = entity.z ?? 0;
      const rx = Math.sqrt(entity.majorX ** 2 + entity.majorY ** 2 + (entity.majorZ ?? 0) ** 2);
      const ry = rx * (entity.axisRatio ?? 1);
      const rotAngle = Math.atan2(entity.majorY, entity.majorX);
      const startA = entity.startAngle ?? 0;
      let endA = entity.endAngle ?? Math.PI * 2;
      if (endA < startA) {endA += Math.PI * 2;}

      const segments = 64;
      const points: Point3D[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = startA + t * (endA - startA);
        const px = Math.cos(angle) * rx;
        const py = Math.sin(angle) * ry;
        // Apply rotation in DXF XY plane
        const rpx = px * Math.cos(rotAngle) - py * Math.sin(rotAngle);
        const rpy = px * Math.sin(rotAngle) + py * Math.cos(rotAngle);
        // Swap Y↔Z for Three.js Y-up convention
        points.push({ x: cx + rpx, y: cz, z: cy + rpy });
      }

      const isClosed = Math.abs(endA - startA - Math.PI * 2) < 0.01;
      return {
        kind: "polyline",
        points,
        closed: isClosed,
        color,
        layer,
      };
    }

    case "SPLINE": {
      // Use the dxf library's entityToPolyline for spline interpolation
      try {
        const polylinePoints: Array<[number, number]> = dxf.entityToPolyline(entity);
        if (!polylinePoints || polylinePoints.length < 2) {return null;}
        return {
          kind: "polyline",
          // Swap Y↔Z: DXF [x,y] → Three.js {x, y:0, z:dxf_y}
          points: polylinePoints.map((p: number[]) => ({
            x: p[0],
            y: 0,
            z: p[1],
          })),
          closed: entity.closed ?? false,
          color,
          layer,
        };
      } catch {
        return null;
      }
    }

    default:
      // Skip unsupported entity types (HATCH, DIMENSION, INSERT after denorm, etc.)
      return null;
  }
}

export class DxfConverter implements FormatConverter {
  readonly formatName = "DXF";
  readonly extensions = [".dxf"];

  async convert(filePath: string): Promise<ConversionResult> {
    // Try UTF-8 first, fallback to latin1
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      content = fs.readFileSync(filePath, "latin1");
    }

    const parsed: DxfParseResult = dxf.parseString(content);
    const layers = parsed.tables?.layers ?? {};

    // Denormalise resolves INSERT/BLOCK references into flat entities
    const denormalisedEntities: DxfEntity[] = dxf.denormalise(parsed);

    const entities: GeometryEntity[] = [];
    const layerCounts = new Map<string, number>();

    for (const entity of denormalisedEntities) {
      const converted = convertEntity(entity, layers);
      if (converted) {
        entities.push(converted);
        const ln = converted.layer ?? "__default__";
        layerCounts.set(ln, (layerCounts.get(ln) ?? 0) + 1);
      }
    }

    // Build bounds
    const min: Point3D = { x: Infinity, y: Infinity, z: Infinity };
    const max: Point3D = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (const entity of entities) {
      const points = getEntityPoints(entity);
      for (const p of points) {
        min.x = Math.min(min.x, p.x);
        min.y = Math.min(min.y, p.y);
        min.z = Math.min(min.z, p.z);
        max.x = Math.max(max.x, p.x);
        max.y = Math.max(max.y, p.y);
        max.z = Math.max(max.z, p.z);
      }
    }

    // Fallback if empty
    if (!isFinite(min.x)) {
      min.x = min.y = min.z = 0;
      max.x = max.y = max.z = 0;
    }

    // Build layer info
    const layerInfos: LayerInfo[] = [];
    for (const [name, count] of layerCounts) {
      const layerDef = layers[name];
      let color: Color | undefined;
      if (layerDef) {
        const rgb = dxfColors[layerDef.colorNumber];
        if (rgb) {
          color = { r: rgb[0] / 255, g: rgb[1] / 255, b: rgb[2] / 255, a: 1 };
        }
      }
      layerInfos.push({ name, color, entityCount: count, visible: true });
    }

    const data: GeometryData = {
      entities,
      bounds: { min, max },
      layers: layerInfos,
      metadata: {
        format: "DXF",
        totalEntities: String(denormalisedEntities.length),
        convertedEntities: String(entities.length),
        skippedEntities: String(denormalisedEntities.length - entities.length),
      },
      coordinateSystem: "local",
    };

    return { kind: "geometry", data };
  }
}

function getEntityPoints(entity: GeometryEntity): Point3D[] {
  switch (entity.kind) {
    case "line":
      return [entity.start, entity.end];
    case "polyline":
      return entity.points;
    case "polygon":
      return entity.rings.flat();
    case "circle":
      return [
        { x: entity.center.x - entity.radius, y: entity.center.y, z: entity.center.z },
        { x: entity.center.x + entity.radius, y: entity.center.y, z: entity.center.z },
        { x: entity.center.x, y: entity.center.y - entity.radius, z: entity.center.z },
        { x: entity.center.x, y: entity.center.y + entity.radius, z: entity.center.z },
      ];
    case "arc":
      return [entity.center];
    case "text":
      return [entity.position];
    case "mesh": {
      const points: Point3D[] = [];
      for (let i = 0; i < entity.vertices.length; i += 3) {
        points.push({ x: entity.vertices[i], y: entity.vertices[i + 1], z: entity.vertices[i + 2] });
      }
      return points;
    }
  }
}
