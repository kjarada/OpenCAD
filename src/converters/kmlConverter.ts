import * as fs from "fs";
import * as path from "path";
import type { ConversionResult, FormatConverter } from "./converter";
import type { GeometryData, LayerInfo } from "../types/geometry";
import { geojsonToEntities, computeBounds } from "./geoUtils";
import * as togeojson from "@mapbox/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import type { FeatureCollection } from "geojson";

export class KmlConverter implements FormatConverter {
  readonly formatName = "KML/KMZ";
  readonly extensions = [".kml", ".kmz"];

  async convert(filePath: string): Promise<ConversionResult> {
    const ext = path.extname(filePath).toLowerCase();
    let kmlContent: string;

    if (ext === ".kmz") {
      kmlContent = await this.extractKmlFromKmz(filePath);
    } else {
      kmlContent = fs.readFileSync(filePath, "utf-8");
    }

    const doc = new DOMParser().parseFromString(kmlContent, "text/xml");
    const geojson: FeatureCollection = togeojson.kml(doc);

    if (!geojson.features || geojson.features.length === 0) {
      throw new Error("No features found in KML file");
    }

    const { entities, layerCounts } = geojsonToEntities(geojson);
    const bounds = computeBounds(entities);

    const layerInfos: LayerInfo[] = [];
    for (const [name, count] of layerCounts) {
      layerInfos.push({ name, entityCount: count, visible: true });
    }

    const data: GeometryData = {
      entities,
      bounds,
      layers: layerInfos,
      metadata: {
        format: ext === ".kmz" ? "KMZ" : "KML",
        featureCount: String(geojson.features.length),
        entityCount: String(entities.length),
      },
      coordinateSystem: "geographic",
    };

    return { kind: "geometry", data };
  }

  private async extractKmlFromKmz(filePath: string): Promise<string> {
    // Dynamic import for jszip to avoid bundling issues
    const JSZip = (await import("jszip")).default;

    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);

    // Find the .kml file inside the KMZ
    const kmlFiles = Object.keys(zip.files).filter((name) =>
      name.toLowerCase().endsWith(".kml")
    );

    if (kmlFiles.length === 0) {
      throw new Error("No KML file found inside KMZ archive");
    }

    // Prefer doc.kml (standard name), otherwise take the first .kml
    const kmlFileName =
      kmlFiles.find((f) => f.toLowerCase() === "doc.kml") ?? kmlFiles[0];

    const kmlContent = await zip.files[kmlFileName].async("string");
    return kmlContent;
  }
}
