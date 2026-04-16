import type { Point3D, GeometryEntity, Color } from "../types/geometry";
import type { Feature, Geometry, Position, FeatureCollection } from "geojson";

const EARTH_RADIUS_M = 6371000;

interface ProjectionContext {
  centroidLon: number;
  centroidLat: number;
  cosLat: number;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Compute the centroid of all coordinates in a GeoJSON FeatureCollection.
 */
function computeCentroid(fc: FeatureCollection): { lon: number; lat: number } {
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  function accumulatePositions(coords: Position[]): void {
    for (const c of coords) {
      sumLon += c[0];
      sumLat += c[1];
      count++;
    }
  }

  function accumulateGeometry(geom: Geometry): void {
    switch (geom.type) {
      case "Point":
        sumLon += geom.coordinates[0];
        sumLat += geom.coordinates[1];
        count++;
        break;
      case "MultiPoint":
      case "LineString":
        accumulatePositions(geom.coordinates);
        break;
      case "MultiLineString":
      case "Polygon":
        for (const ring of geom.coordinates) {
          accumulatePositions(ring);
        }
        break;
      case "MultiPolygon":
        for (const polygon of geom.coordinates) {
          for (const ring of polygon) {
            accumulatePositions(ring);
          }
        }
        break;
      case "GeometryCollection":
        for (const g of geom.geometries) {
          accumulateGeometry(g);
        }
        break;
    }
  }

  for (const feature of fc.features) {
    if (feature.geometry) {
      accumulateGeometry(feature.geometry);
    }
  }

  if (count === 0) {return { lon: 0, lat: 0 };}
  return { lon: sumLon / count, lat: sumLat / count };
}

/**
 * Project a lon/lat/alt position to local Cartesian coordinates (meters).
 * Uses equirectangular approximation centered on the dataset centroid.
 * X = east, Y = up (altitude), Z = north
 */
function projectPosition(pos: Position, ctx: ProjectionContext): Point3D {
  const lon = pos[0];
  const lat = pos[1];
  const alt = pos[2] ?? 0;

  const x = toRadians(lon - ctx.centroidLon) * EARTH_RADIUS_M * ctx.cosLat;
  const z = toRadians(lat - ctx.centroidLat) * EARTH_RADIUS_M;
  const y = alt;

  return { x, y, z };
}

function projectPositions(positions: Position[], ctx: ProjectionContext): Point3D[] {
  return positions.map((p) => projectPosition(p, ctx));
}

/**
 * Convert a GeoJSON FeatureCollection to an array of GeometryEntities,
 * projecting geographic coordinates to local Cartesian.
 */
export function geojsonToEntities(
  fc: FeatureCollection,
  defaultColor?: Color
): { entities: GeometryEntity[]; layerCounts: Map<string, number> } {
  const centroid = computeCentroid(fc);
  const ctx: ProjectionContext = {
    centroidLon: centroid.lon,
    centroidLat: centroid.lat,
    cosLat: Math.cos(toRadians(centroid.lat)),
  };

  const entities: GeometryEntity[] = [];
  const layerCounts = new Map<string, number>();

  function addEntity(entity: GeometryEntity): void {
    entities.push(entity);
    const ln = entity.layer ?? "__default__";
    layerCounts.set(ln, (layerCounts.get(ln) ?? 0) + 1);
  }

  for (const feature of fc.features) {
    if (!feature.geometry) {continue;}

    const layer = getFeatureLayer(feature);
    const color = getFeatureColor(feature) ?? defaultColor;

    convertGeometry(feature.geometry, layer, color, ctx, addEntity);
  }

  return { entities, layerCounts };
}

function getFeatureLayer(feature: Feature): string | undefined {
  const props = feature.properties;
  if (!props) {return undefined;}
  return (
    props["name"] ??
    props["Name"] ??
    props["NAME"] ??
    props["layer"] ??
    props["Layer"] ??
    undefined
  );
}

function getFeatureColor(feature: Feature): Color | undefined {
  const props = feature.properties;
  if (!props) {return undefined;}

  // KML style colors
  const stroke = props["stroke"];
  if (typeof stroke === "string" && stroke.startsWith("#")) {
    return hexToColor(stroke);
  }
  const fill = props["fill"];
  if (typeof fill === "string" && fill.startsWith("#")) {
    return hexToColor(fill);
  }
  return undefined;
}

function hexToColor(hex: string): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return { r, g, b, a };
}

function convertGeometry(
  geom: Geometry,
  layer: string | undefined,
  color: Color | undefined,
  ctx: ProjectionContext,
  addEntity: (e: GeometryEntity) => void
): void {
  switch (geom.type) {
    case "Point": {
      const p = projectPosition(geom.coordinates, ctx);
      addEntity({ kind: "circle", center: p, radius: 2, color, layer });
      break;
    }

    case "MultiPoint": {
      for (const coord of geom.coordinates) {
        const p = projectPosition(coord, ctx);
        addEntity({ kind: "circle", center: p, radius: 2, color, layer });
      }
      break;
    }

    case "LineString": {
      const points = projectPositions(geom.coordinates, ctx);
      if (points.length >= 2) {
        addEntity({ kind: "polyline", points, closed: false, color, layer });
      }
      break;
    }

    case "MultiLineString": {
      for (const line of geom.coordinates) {
        const points = projectPositions(line, ctx);
        if (points.length >= 2) {
          addEntity({ kind: "polyline", points, closed: false, color, layer });
        }
      }
      break;
    }

    case "Polygon": {
      const rings = geom.coordinates.map((ring) => projectPositions(ring, ctx));
      if (rings.length > 0 && rings[0].length >= 3) {
        addEntity({ kind: "polygon", rings, color, layer });
      }
      break;
    }

    case "MultiPolygon": {
      for (const polygon of geom.coordinates) {
        const rings = polygon.map((ring) => projectPositions(ring, ctx));
        if (rings.length > 0 && rings[0].length >= 3) {
          addEntity({ kind: "polygon", rings, color, layer });
        }
      }
      break;
    }

    case "GeometryCollection": {
      for (const g of geom.geometries) {
        convertGeometry(g, layer, color, ctx, addEntity);
      }
      break;
    }
  }
}

export function computeBounds(entities: GeometryEntity[]): { min: Point3D; max: Point3D } {
  const min: Point3D = { x: Infinity, y: Infinity, z: Infinity };
  const max: Point3D = { x: -Infinity, y: -Infinity, z: -Infinity };

  function expand(p: Point3D): void {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }

  for (const entity of entities) {
    switch (entity.kind) {
      case "line":
        expand(entity.start);
        expand(entity.end);
        break;
      case "polyline":
        entity.points.forEach(expand);
        break;
      case "polygon":
        entity.rings.flat().forEach(expand);
        break;
      case "circle":
        expand({ x: entity.center.x - entity.radius, y: entity.center.y, z: entity.center.z - entity.radius });
        expand({ x: entity.center.x + entity.radius, y: entity.center.y, z: entity.center.z + entity.radius });
        break;
      case "arc":
        expand(entity.center);
        break;
      case "text":
        expand(entity.position);
        break;
      case "mesh":
        for (let i = 0; i < entity.vertices.length; i += 3) {
          expand({ x: entity.vertices[i], y: entity.vertices[i + 1], z: entity.vertices[i + 2] });
        }
        break;
    }
  }

  if (!isFinite(min.x)) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  return { min, max };
}
