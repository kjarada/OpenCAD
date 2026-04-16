import * as fs from "fs";
import type { ConversionResult, FormatConverter } from "./converter";
import type { GeometryData, LayerInfo } from "../types/geometry";
import { geojsonToEntities, computeBounds } from "./geoUtils";
import type { FeatureCollection, Feature } from "geojson";

export class ShapefileConverter implements FormatConverter {
  readonly formatName = "Shapefile";
  readonly extensions = [".shp"];

  async convert(filePath: string): Promise<ConversionResult> {
    const shapefile = await import("shapefile");

    const basename = filePath.replace(/\.shp$/i, "");
    const dbfPath = basename + ".dbf";
    const prjPath = basename + ".prj";

    // Read binary files into ArrayBuffers so shapefile.open() uses its
    // array-source path instead of path-source (which breaks under webpack
    // because webpack resolves the ESM entry that uses fetch/XMLHttpRequest
    // instead of the Node.js fs-based entry).
    const shpBuffer = toUint8Array(fs.readFileSync(filePath));
    const dbfExists = fs.existsSync(dbfPath);
    const dbfBuffer = dbfExists ? toUint8Array(fs.readFileSync(dbfPath)) : undefined;

    const source = await shapefile.open(shpBuffer, dbfBuffer);

    const features: Feature[] = [];
    let result = await source.read();
    while (!result.done) {
      if (result.value) {
        features.push(result.value as Feature);
      }
      result = await source.read();
    }

    if (features.length === 0) {
      throw new Error("No features found in Shapefile");
    }

    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    const { entities, layerCounts } = geojsonToEntities(fc);
    const bounds = computeBounds(entities);

    const layerInfos: LayerInfo[] = [];
    for (const [name, count] of layerCounts) {
      layerInfos.push({ name, entityCount: count, visible: true });
    }

    // Read projection info if available
    const metadata: Record<string, string> = {
      format: "Shapefile",
      featureCount: String(features.length),
      entityCount: String(entities.length),
    };

    if (fs.existsSync(prjPath)) {
      try {
        metadata.projection = fs.readFileSync(prjPath, "utf-8").trim();
      } catch {
        // Ignore projection read errors
      }
    }

    if (!dbfExists) {
      metadata.warning = "No .dbf file found — geometry loaded without attributes";
    }

    const data: GeometryData = {
      entities,
      bounds,
      layers: layerInfos,
      metadata,
      coordinateSystem: "geographic",
    };

    return { kind: "geometry", data };
  }
}

/** Convert a Node.js Buffer to a Uint8Array for the shapefile package. */
function toUint8Array(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
