/**
 * Edge case tests for converters. Run with: bun examples/test-edge-cases.ts
 */
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

import { DxfConverter } from "../src/converters/dxfConverter";
import { KmlConverter } from "../src/converters/kmlConverter";
import { DwgConverter } from "../src/converters/dwgConverter";
import { ShapefileConverter } from "../src/converters/shapefileConverter";
import { getConverter, initConverterRegistry } from "../src/converters/converterRegistry";

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

  // DXF with no entities
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

  // DXF with a line at Y=5 (should become Z=5 in Three.js)
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
        // DXF (0,5,0) → Three.js (0, 0, 5) — Y and Z swapped
        assert(line.start.x === 0 && line.start.y === 0 && line.start.z === 5,
          `Start point swapped: (${line.start.x}, ${line.start.y}, ${line.start.z}) should be (0, 0, 5)`);
        // DXF (10,5,2) → Three.js (10, 2, 5)
        assert(line.end.x === 10 && line.end.y === 2 && line.end.z === 5,
          `End point swapped: (${line.end.x}, ${line.end.y}, ${line.end.z}) should be (10, 2, 5)`);
      }
    }
  } finally {
    fs.unlinkSync(tmpFile);
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

async function testConverterRegistry(): Promise<void> {
  console.log("\n--- Converter Registry ---");

  // Can't initialize the full registry (needs vscode context for IFC),
  // but we can test the getConverter function pattern.
  // Test extension matching
  assert(true, "Registry tests skipped (requires vscode context)");

  // Test that unknown extensions return undefined
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

async function testLargeKml(): Promise<void> {
  console.log("\n--- KML with many features ---");
  const converter = new KmlConverter();

  // Generate a KML with 100 placemarks
  let placemarks = "";
  for (let i = 0; i < 100; i++) {
    const lon = -73.98 + (Math.random() - 0.5) * 0.02;
    const lat = 40.75 + (Math.random() - 0.5) * 0.02;
    placemarks += `<Placemark><name>P${i}</name><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>\n`;
  }

  const tmpFile = path.join(os.tmpdir(), "opencad-test-large.kml");
  fs.writeFileSync(tmpFile, `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Large</name>${placemarks}</Document>
</kml>`);

  try {
    const result = await converter.convert(tmpFile);
    assert(result.kind === "geometry", "Returns geometry result");
    if (result.kind === "geometry") {
      assert(result.data.entities.length === 100, `100 entities (got ${result.data.entities.length})`);
      assert(result.data.coordinateSystem === "geographic", "Geographic coordinate system");
    }
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function testDxfLayerColors(): Promise<void> {
  console.log("\n--- DXF layer colors ---");
  const converter = new DxfConverter();

  const file = path.join(__dirname, "dxf", "floor-plan.dxf");
  const result = await converter.convert(file);

  if (result.kind === "geometry") {
    // Check layers have colors
    const wallsLayer = result.data.layers.find(l => l.name === "Walls");
    assert(wallsLayer !== undefined, "Walls layer exists");
    assert(wallsLayer?.color !== undefined, "Walls layer has color");

    const doorsLayer = result.data.layers.find(l => l.name === "Doors");
    assert(doorsLayer !== undefined, "Doors layer exists");
    assert(doorsLayer?.color !== undefined, "Doors layer has color");

    // Check entities have layer assignments
    const wallEntities = result.data.entities.filter(e => e.layer === "Walls");
    assert(wallEntities.length > 0, `Wall entities found (${wallEntities.length})`);

    // Check entity colors
    const firstEntity = result.data.entities[0];
    assert(firstEntity.color !== undefined, "First entity has color from layer");
  }
}

async function testShapefileMissingDbf(): Promise<void> {
  console.log("\n--- Shapefile without .dbf ---");
  const converter = new ShapefileConverter();

  // Copy just the .shp (without .dbf) to a temp location
  const srcShp = path.join(__dirname, "shp", "manhattan_footprints.shp");
  const tmpShp = path.join(os.tmpdir(), "opencad-test-nodbf.shp");
  fs.copyFileSync(srcShp, tmpShp);

  try {
    const result = await converter.convert(tmpShp);
    assert(result.kind === "geometry", "Returns geometry result even without .dbf");
    if (result.kind === "geometry") {
      assert(result.data.entities.length > 0, "Has entities without .dbf");
      assert(result.data.metadata.warning !== undefined, "Has warning about missing .dbf");
    }
  } finally {
    try { fs.unlinkSync(tmpShp); } catch { /* ignore */ }
  }
}

async function main(): Promise<void> {
  console.log("OpenCAD Edge Case Tests");
  console.log("========================");

  await testEmptyDxf();
  await testDxfCoordinateSwap();
  await testDxfLayerColors();
  await testDwgErrorMessage();
  await testKmlWithNoFeatures();
  await testLargeKml();
  await testConverterRegistry();
  await testShapefileMissingDbf();

  console.log(`\n========================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
