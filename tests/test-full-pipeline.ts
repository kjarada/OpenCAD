/**
 * Full pipeline test - tests our actual converter classes end-to-end.
 * Run with: bun examples/test-full-pipeline.ts
 */
import * as path from "path";
import * as fs from "fs";

import { DxfConverter } from "../src/converters/dxfConverter";
import { KmlConverter } from "../src/converters/kmlConverter";
import { ShapefileConverter } from "../src/converters/shapefileConverter";
import type { GeometryData } from "../src/types/geometry";

const SAMPLES = path.join(__dirname, "..", "samples");

function summarizeGeometry(data: GeometryData): void {
  console.log(`  Entities: ${data.entities.length}`);
  console.log(`  Layers: ${data.layers.length}`);
  console.log(`  Coordinate system: ${data.coordinateSystem}`);
  console.log(`  Bounds: [${data.bounds.min.x.toFixed(1)}, ${data.bounds.min.y.toFixed(1)}, ${data.bounds.min.z.toFixed(1)}] → [${data.bounds.max.x.toFixed(1)}, ${data.bounds.max.y.toFixed(1)}, ${data.bounds.max.z.toFixed(1)}]`);

  const kindCounts: Record<string, number> = {};
  for (const e of data.entities) {
    kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1;
  }
  console.log(`  Entity kinds: ${JSON.stringify(kindCounts)}`);
}

async function testDxfConverter(): Promise<void> {
  console.log("\n=== DXF Converter ===");
  const converter = new DxfConverter();

  const files = fs.readdirSync(path.join(SAMPLES, "dxf"))
    .filter(f => f.endsWith(".dxf"))
    .map(f => path.join(SAMPLES, "dxf", f));

  for (const file of files) {
    console.log(`\n  File: ${path.basename(file)}`);
    const result = await converter.convert(file);
    if (result.kind === "geometry") {
      summarizeGeometry(result.data);
    }
  }
  console.log("\n  DXF: PASS");
}

async function testKmlConverter(): Promise<void> {
  console.log("\n=== KML Converter ===");
  const converter = new KmlConverter();

  const files = fs.readdirSync(path.join(SAMPLES, "kml"))
    .filter(f => f.endsWith(".kml"))
    .map(f => path.join(SAMPLES, "kml", f));

  for (const file of files) {
    console.log(`\n  File: ${path.basename(file)}`);
    const result = await converter.convert(file);
    if (result.kind === "geometry") {
      summarizeGeometry(result.data);
    }
  }
  console.log("\n  KML: PASS");
}

async function testShapefileConverter(): Promise<void> {
  console.log("\n=== Shapefile Converter ===");
  const converter = new ShapefileConverter();

  const shpFiles = fs.readdirSync(path.join(SAMPLES, "shp"))
    .filter(f => f.endsWith(".shp"))
    .map(f => path.join(SAMPLES, "shp", f));

  for (const file of shpFiles) {
    console.log(`\n  File: ${path.basename(file)}`);
    const result = await converter.convert(file);
    if (result.kind === "geometry") {
      summarizeGeometry(result.data);
    }
  }
  console.log("\n  Shapefile: PASS");
}

async function main(): Promise<void> {
  console.log("OpenCAD Full Pipeline Tests");
  console.log("===========================");

  let failures = 0;

  try { await testDxfConverter(); } catch (err) { console.error("  DXF: FAIL -", err); failures++; }
  try { await testKmlConverter(); } catch (err) { console.error("  KML: FAIL -", err); failures++; }
  try { await testShapefileConverter(); } catch (err) { console.error("  Shapefile: FAIL -", err); failures++; }

  console.log("\n===========================");
  if (failures > 0) {
    console.log(`${failures} converter(s) FAILED`);
    process.exit(1);
  } else {
    console.log("All pipeline tests PASSED.");
  }
}

main();
