import type { GeometryData } from "../types/geometry";

/** Result of converting a file — either binary GLB or structured geometry */
export type ConversionResult =
  | { kind: "glb"; data: Buffer }
  | { kind: "geometry"; data: GeometryData };

/** Common interface that all format converters implement */
export interface FormatConverter {
  readonly formatName: string;
  readonly extensions: string[];
  convert(filePath: string): Promise<ConversionResult>;
}
