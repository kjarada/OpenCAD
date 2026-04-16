/** A single point in 3D space */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Color as RGBA 0-1 floats */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface LineEntity {
  kind: "line";
  start: Point3D;
  end: Point3D;
  color?: Color;
  lineWidth?: number;
  layer?: string;
}

export interface PolylineEntity {
  kind: "polyline";
  points: Point3D[];
  closed: boolean;
  color?: Color;
  lineWidth?: number;
  layer?: string;
}

export interface PolygonEntity {
  kind: "polygon";
  rings: Point3D[][]; // outer ring first, then holes
  color?: Color;
  extrudeHeight?: number;
  layer?: string;
}

export interface CircleEntity {
  kind: "circle";
  center: Point3D;
  radius: number;
  color?: Color;
  layer?: string;
}

export interface ArcEntity {
  kind: "arc";
  center: Point3D;
  radius: number;
  startAngle: number; // radians
  endAngle: number; // radians
  color?: Color;
  layer?: string;
}

export interface TextEntity {
  kind: "text";
  position: Point3D;
  content: string;
  height: number;
  rotation?: number; // radians
  color?: Color;
  layer?: string;
}

export interface MeshEntity {
  kind: "mesh";
  vertices: number[]; // flat xyz array
  indices: number[]; // triangle indices
  normals?: number[]; // flat xyz array
  color?: Color;
  layer?: string;
}

/** All geometry entity types the renderer can handle */
export type GeometryEntity =
  | LineEntity
  | PolylineEntity
  | PolygonEntity
  | CircleEntity
  | ArcEntity
  | TextEntity
  | MeshEntity;

export interface LayerInfo {
  name: string;
  color?: Color;
  entityCount: number;
  visible: boolean;
}

/** Parsed geometry ready for the webview to render */
export interface GeometryData {
  entities: GeometryEntity[];
  bounds: { min: Point3D; max: Point3D };
  layers: LayerInfo[];
  metadata: Record<string, string>;
  coordinateSystem: "local" | "geographic";
}
