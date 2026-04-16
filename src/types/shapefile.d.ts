declare module "shapefile" {
  import type { Feature } from "geojson";

  interface Source {
    read(): Promise<{ done: boolean; value?: Feature }>;
  }

  export function open(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<Source>;

  export function read(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{ type: "FeatureCollection"; features: Feature[] }>;
}
