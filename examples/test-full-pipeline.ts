/**
 * Full pipeline test - tests our actual converter classes end-to-end.
 * Run with: bun examples/test-full-pipeline.ts
 */
import * as path from "path";

// We need to mock vscode for the IfcConverter, so skip IFC in this test.
// We test DXF, KML, and Shapefile converters directly.

import { DxfConverter } from "../src/converters/dxfConverter";
import { KmlConverter } from "../src/converters/kmlConverter";
import { ShapefileConverter } from "../src/converters/shapefileConverter";
import type { GeometryData } from "../src/types/geometry";

function summarizeGeometry(data: GeometryData): void {
  console.log(`  Entities: ${data.entities.length}`);
  console.log(`  Layers: ${data.layers.map(l => `${l.name}(${l.entityCount})`).join(", ")}`);
  console.log(`  Coordinate system: ${data.coordinateSystem}`);
  console.log(`  Bounds: [${data.bounds.min.x.toFixed(2)}, ${data.bounds.min.y.toFixed(2)}, ${data.bounds.min.z.toFixed(2)}] → [${data.bounds.max.x.toFixed(2)}, ${data.bounds.max.y.toFixed(2)}, ${data.bounds.max.z.toFixed(2)}]`);
  console.log(`  Metadata: ${JSON.stringify(data.metadata)}`);

  // Count by kind
  const kindCounts: Record<string, number> = {};
  for (const e of data.entities) {
    kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1;
  }
  console.log(`  Entity kinds: ${JSON.stringify(kindCounts)}`);

  // Validate all entities have reasonable data
  let issues = 0;
  for (const e of data.entities) {
    switch (e.kind) {
      case "line":
        if (e.start.x === e.end.x && e.start.y === e.end.y && e.start.z === e.end.z) {
          console.log(`  WARNING: Zero-length line found`);
          issues++;
        }
        break;
      case "polyline":
        if (e.points.length < 2) {
          console.log(`  WARNING: Polyline with < 2 points`);
          issues++;
        }
        break;
      case "polygon":
        if (e.rings.length === 0 || e.rings[0].length < 3) {
          console.log(`  WARNING: Polygon with no valid outer ring`);
          issues++;
        }
        break;
      case "circle":
        if (e.radius <= 0) {
          console.log(`  WARNING: Circle with non-positive radius`);
          issues++;
        }
        break;
    }
  }
  if (issues === 0) {
    console.log(`  Validation: All entities valid`);
  } else {
    console.log(`  Validation: ${issues} issues found`);
  }
}

async function testDxfConverter(): Promise<void> {
  console.log("\n=== DXF Converter (full pipeline) ===");
  const converter = new DxfConverter();

  const files = [
    path.join(__dirname, "dxf", "floor-plan.dxf"),
    path.join(__dirname, "dxf", "shapes.dxf"),
  ];

  for (const file of files) {
    console.log(`\nFile: ${path.basename(file)}`);
    const result = await converter.convert(file);

    if (result.kind !== "geometry") {
      console.log("  FAIL: Expected geometry result, got glb");
      continue;
    }

    summarizeGeometry(result.data);
  }
  console.log("\n  DXF Converter: PASS");
}

async function testKmlConverter(): Promise<void> {
  console.log("\n=== KML Converter (full pipeline) ===");
  const converter = new KmlConverter();

  const file = path.join(__dirname, "kml", "landmarks.kml");
  console.log(`\nFile: ${path.basename(file)}`);
  const result = await converter.convert(file);

  if (result.kind !== "geometry") {
    console.log("  FAIL: Expected geometry result, got glb");
    return;
  }

  summarizeGeometry(result.data);
  console.log("\n  KML Converter: PASS");
}

async function testShapefileConverter(): Promise<void> {
  console.log("\n=== Shapefile Converter (full pipeline) ===");
  const converter = new ShapefileConverter();

  const file = path.join(__dirname, "shp", "manhattan_footprints.shp");
  console.log(`\nFile: ${path.basename(file)}`);
  const result = await converter.convert(file);

  if (result.kind !== "geometry") {
    console.log("  FAIL: Expected geometry result, got glb");
    return;
  }

  summarizeGeometry(result.data);
  console.log("\n  Shapefile Converter: PASS");
}

async function main(): Promise<void> {
  console.log("OpenCAD Full Pipeline Tests");
  console.log("===========================");

  let failures = 0;

  try {
    await testDxfConverter();
  } catch (err) {
    console.error("  DXF Converter: FAIL -", err);
    failures++;
  }

  try {
    await testKmlConverter();
  } catch (err) {
    console.error("  KML Converter: FAIL -", err);
    failures++;
  }

  try {
    await testShapefileConverter();
  } catch (err) {
    console.error("  Shapefile Converter: FAIL -", err);
    failures++;
  }

  console.log("\n===========================");
  if (failures > 0) {
    console.log(`${failures} converter(s) FAILED`);
    process.exit(1);
  } else {
    console.log("All full pipeline tests PASSED.");
  }
}

main();
