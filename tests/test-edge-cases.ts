/**
 * Edge case tests for converters. Run with: bun tests/test-edge-cases.ts
 */
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

import { DxfConverter } from "../src/converters/dxfConverter";
import { KmlConverter } from "../src/converters/kmlConverter";
import { DwgConverter } from "../src/converters/dwgConverter";
import { ShapefileConverter } from "../src/converters/shapefileConverter";

const SAMPLES = path.join(__dirname, "..", "samples");

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

async function testEmptyDxf(): Promise<void> {
  console.log("\n--- Empty DXF ---");
  const converter = new DxfConverter();

  const tmpFile = path.join(os.tmpdir(), "opencad-test-empty.dxf");
  fs.writeFileSync(tmpFile, `0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n`);

  try {
    const result = await converter.convert(tmpFile);
    assert(result.kind === "geometry", "Returns geometry result");
    if (result.kind === "geometry") {
      assert(result.data.entities.length === 0, "Zero entities");
      assert(result.data.bounds.min.x === 0, "Fallback bounds");
    }
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function testDxfCoordinateSwap(): Promise<void> {
  console.log("\n--- DXF Y/Z coordinate swap ---");
  const converter = new DxfConverter();

  const tmpFile = path.join(os.tmpdir(), "opencad-test-yz.dxf");
  fs.writeFileSync(tmpFile, [
    "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "8", "test",
    "10", "0.0", "20", "5.0", "30", "0.0",
    "11", "10.0", "21", "5.0", "31", "2.0",
    "0", "ENDSEC", "0", "EOF"
  ].join("\n"));

  try {
    const result = await converter.convert(tmpFile);
    assert(result.kind === "geometry", "Returns geometry result");
    if (result.kind === "geometry") {
      const line = result.data.entities[0];
      assert(line.kind === "line", "Is a line entity");
      if (line.kind === "line") {
        assert(line.start.x === 0 && line.start.y === 0 && line.start.z === 5,
          `Start (0,0,5): got (${line.start.x}, ${line.start.y}, ${line.start.z})`);
        assert(line.end.x === 10 && line.end.y === 2 && line.end.z === 5,
          `End (10,2,5): got (${line.end.x}, ${line.end.y}, ${line.end.z})`);
      }
    }
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function testDxfRealFile(): Promise<void> {
  console.log("\n--- DXF real file (uncommon.dxf) ---");
  const converter = new DxfConverter();

  const file = path.join(SAMPLES, "dxf", "uncommon.dxf");
  if (!fs.existsSync(file)) {
    console.log("  SKIP: file not found");
    return;
  }

  const result = await converter.convert(file);
  assert(result.kind === "geometry", "Returns geometry result");
  if (result.kind === "geometry") {
    assert(result.data.entities.length > 0, `Has entities (${result.data.entities.length})`);
    assert(result.data.layers.length > 0, `Has layers (${result.data.layers.length})`);
    assert(result.data.coordinateSystem === "local", "Local coordinate system");

    // Check some entity has a color
    const withColor = result.data.entities.filter(e => e.color !== undefined);
    assert(withColor.length > 0, `Entities with colors (${withColor.length})`);
  }
}

async function testDwgErrorMessage(): Promise<void> {
  console.log("\n--- DWG shows helpful error ---");
  const converter = new DwgConverter();

  const tmpFile = path.join(os.tmpdir(), "opencad-test.dwg");
  fs.writeFileSync(tmpFile, "fake dwg content");

  try {
    await converter.convert(tmpFile);
    assert(false, "Should have thrown");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("DXF"), "Error mentions DXF export suggestion");
    assert(msg.includes("experimental"), "Error mentions experimental status");
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function testKmlWithNoFeatures(): Promise<void> {
  console.log("\n--- KML with no placemarks ---");
  const converter = new KmlConverter();

  const tmpFile = path.join(os.tmpdir(), "opencad-test-empty.kml");
  fs.writeFileSync(tmpFile, `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Empty</name></Document>
</kml>`);

  try {
    await converter.convert(tmpFile);
    assert(false, "Should have thrown for empty KML");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("No features"), "Error mentions no features");
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function testKmlRealFile(): Promise<void> {
  console.log("\n--- KML real file (KML_Samples.kml) ---");
  const converter = new KmlConverter();

  const file = path.join(SAMPLES, "kml", "KML_Samples.kml");
  if (!fs.existsSync(file)) {
    console.log("  SKIP: file not found");
    return;
  }

  const result = await converter.convert(file);
  assert(result.kind === "geometry", "Returns geometry result");
  if (result.kind === "geometry") {
    assert(result.data.entities.length > 5, `Has many entities (${result.data.entities.length})`);
    assert(result.data.coordinateSystem === "geographic", "Geographic coordinate system");

    const kinds = new Set(result.data.entities.map(e => e.kind));
    assert(kinds.size > 1, `Multiple entity kinds (${[...kinds].join(", ")})`);
  }
}

async function testConverterRegistry(): Promise<void> {
  console.log("\n--- Converter Registry ---");

  const DxfConv = new DxfConverter();
  assert(DxfConv.extensions.includes(".dxf"), "DXF converter handles .dxf");
  assert(DxfConv.formatName === "DXF", "DXF converter format name");

  const KmlConv = new KmlConverter();
  assert(KmlConv.extensions.includes(".kml"), "KML converter handles .kml");
  assert(KmlConv.extensions.includes(".kmz"), "KML converter handles .kmz");

  const ShpConv = new ShapefileConverter();
  assert(ShpConv.extensions.includes(".shp"), "Shapefile converter handles .shp");

  const DwgConv = new DwgConverter();
  assert(DwgConv.extensions.includes(".dwg"), "DWG converter handles .dwg");
}

async function testShapefileRealFile(): Promise<void> {
  console.log("\n--- Shapefile real file (Natural Earth lakes) ---");
  const converter = new ShapefileConverter();

  const file = path.join(SAMPLES, "shp", "ne_110m_lakes.shp");
  if (!fs.existsSync(file)) {
    console.log("  SKIP: file not found");
    return;
  }

  const result = await converter.convert(file);
  assert(result.kind === "geometry", "Returns geometry result");
  if (result.kind === "geometry") {
    assert(result.data.entities.length > 0, `Has entities (${result.data.entities.length})`);
    assert(result.data.coordinateSystem === "geographic", "Geographic coordinate system");

    const polygons = result.data.entities.filter(e => e.kind === "polygon");
    assert(polygons.length > 0, `Has polygon entities (${polygons.length})`);
  }
}

async function main(): Promise<void> {
  console.log("OpenCAD Edge Case Tests");
  console.log("========================");

  await testEmptyDxf();
  await testDxfCoordinateSwap();
  await testDxfRealFile();
  await testDwgErrorMessage();
  await testKmlWithNoFeatures();
  await testKmlRealFile();
  await testConverterRegistry();
  await testShapefileRealFile();

  console.log(`\n========================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
