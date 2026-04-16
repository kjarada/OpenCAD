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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entityToPolyline = require("dxf/lib/entityToPolyline").default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const applyTransforms = require("dxf/lib/applyTransforms").default;

interface DxfPolyline {
  rgb: [number, number, number];
  layer: { name: string; colorNumber: number } | undefined;
  vertices: Array<[number, number]>;
}

interface DxfPolylinesResult {
  polylines: DxfPolyline[];
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

    const parsed = dxf.parseString(content);

    // Use denormalise + entityToPolyline + applyTransforms manually so we can
    // skip entities that entityToPolyline doesn't support (DIMENSION, ATTDEF, etc.)
    const denormalisedEntities = dxf.denormalise(parsed);
    const polylines: DxfPolyline[] = [];

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dxfColors: Array<[number, number, number]> = require("dxf/lib/util/colors").default;
    const layers = parsed.tables?.layers ?? {};

    for (const entity of denormalisedEntities) {
      try {
        const vertices: Array<[number, number]> = entityToPolyline(entity);
        if (!vertices || vertices.length === 0) {
          continue;
        }
        const transformed: Array<[number, number]> = entity.transforms
          ? applyTransforms(vertices, entity.transforms)
          : vertices;

        const layerTable = layers[entity.layer];
        let colorNumber = 0;
        if ("colorNumber" in entity) {
          colorNumber = entity.colorNumber;
        } else if (layerTable) {
          colorNumber = layerTable.colorNumber;
        }
        const rgb = dxfColors[colorNumber] ?? dxfColors[0];

        polylines.push({ rgb, layer: layerTable, vertices: transformed });
      } catch {
        // Skip entities that entityToPolyline can't handle (DIMENSION, ATTDEF, VIEWPORT, etc.)
        continue;
      }
    }

    const result: DxfPolylinesResult = { polylines };

    const entities: GeometryEntity[] = [];
    const layerCounts = new Map<string, number>();

    for (const polyline of result.polylines) {
      if (!polyline.vertices || polyline.vertices.length === 0) {
        continue;
      }

      const color = rgbToColor(polyline.rgb);
      const layer = polyline.layer?.name;

      // DXF uses X-right, Y-forward, Z-up. Three.js uses Y-up.
      // Swap Y↔Z so floor plans render horizontally on the XZ ground plane.
      const points: Point3D[] = polyline.vertices.map((v) => ({
        x: v[0],
        y: 0,
        z: v[1],
      }));

      if (points.length === 1) {
        // Single point → render as small circle
        entities.push({
          kind: "circle",
          center: points[0],
          radius: 0.1,
          color,
          layer,
        });
      } else {
        entities.push({
          kind: "polyline",
          points,
          closed: false,
          color,
          layer,
        });
      }

      const ln = layer ?? "__default__";
      layerCounts.set(ln, (layerCounts.get(ln) ?? 0) + 1);
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

    // Build layer info from parsed layer table
    const layerInfos: LayerInfo[] = [];
    for (const [name, count] of layerCounts) {
      const layerDef = layers[name];
      let layerColor: Color | undefined;
      if (layerDef) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dxfColors: Array<[number, number, number]> = require("dxf/lib/util/colors").default;
        const rgb = dxfColors[layerDef.colorNumber];
        if (rgb) {
          layerColor = { r: rgb[0] / 255, g: rgb[1] / 255, b: rgb[2] / 255, a: 1 };
        }
      }
      layerInfos.push({ name, color: layerColor, entityCount: count, visible: true });
    }

    const data: GeometryData = {
      entities,
      bounds: { min, max },
      layers: layerInfos,
      metadata: {
        format: "DXF",
        totalPolylines: String(result.polylines.length),
        renderedEntities: String(entities.length),
      },
      coordinateSystem: "local",
    };

    return { kind: "geometry", data };
  }
}

function rgbToColor(rgb: [number, number, number] | undefined): Color | undefined {
  if (!rgb) {
    return undefined;
  }
  return { r: rgb[0] / 255, g: rgb[1] / 255, b: rgb[2] / 255, a: 1 };
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
        { x: entity.center.x, y: entity.center.y, z: entity.center.z - entity.radius },
        { x: entity.center.x, y: entity.center.y, z: entity.center.z + entity.radius },
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
