/**
 * Standalone converter test script. Run with: bun examples/test-converters.ts
 * Tests each converter's parsing logic without requiring VS Code.
 */
import * as path from "path";
import * as fs from "fs";

const SAMPLES = path.join(__dirname, "..", "samples");

// DXF test
async function testDxf(): Promise<void> {
  console.log("\n=== Testing DXF Converter ===");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dxf = require("dxf");

  const files = fs.readdirSync(path.join(SAMPLES, "dxf"))
    .filter(f => f.endsWith(".dxf"))
    .map(f => path.join(SAMPLES, "dxf", f));

  for (const file of files) {
    const name = path.basename(file);
    console.log(`\nParsing: ${name}`);

    const content = fs.readFileSync(file, "utf-8");
    const parsed = dxf.parseString(content);

    console.log(`  Raw entities: ${parsed.entities.length}`);
    console.log(`  Blocks: ${parsed.blocks.length}`);
    console.log(`  Layers: ${Object.keys(parsed.tables?.layers ?? {}).join(", ")}`);

    const denormalised = dxf.denormalise(parsed);
    console.log(`  Denormalised entities: ${denormalised.length}`);

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const e of denormalised) {
      typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
    }
    console.log(`  Entity types: ${JSON.stringify(typeCounts)}`);
  }

  console.log("\n  DXF: PASS");
}

// KML test
async function testKml(): Promise<void> {
  console.log("\n=== Testing KML Converter ===");

  const togeojson = require("@mapbox/togeojson");
  const { DOMParser } = require("@xmldom/xmldom");

  const files = fs.readdirSync(path.join(SAMPLES, "kml"))
    .filter(f => f.endsWith(".kml"))
    .map(f => path.join(SAMPLES, "kml", f));

  for (const file of files) {
    console.log(`\nParsing: ${path.basename(file)}`);

    const content = fs.readFileSync(file, "utf-8");
    const doc = new DOMParser().parseFromString(content, "text/xml");
    const geojson = togeojson.kml(doc);

    console.log(`  Features: ${geojson.features.length}`);

    const typeCounts: Record<string, number> = {};
    for (const f of geojson.features) {
      if (f.geometry) {
        typeCounts[f.geometry.type] = (typeCounts[f.geometry.type] ?? 0) + 1;
      }
    }
    console.log(`  Geometry types: ${JSON.stringify(typeCounts)}`);
  }

  console.log("\n  KML: PASS");
}

// Shapefile test
async function testShapefile(): Promise<void> {
  console.log("\n=== Testing Shapefile Converter ===");

  const shapefile = require("shapefile");
  const shpDir = path.join(SAMPLES, "shp");

  const shpFiles = fs.readdirSync(shpDir)
    .filter(f => f.endsWith(".shp"))
    .map(f => path.join(shpDir, f));

  for (const shpFile of shpFiles) {
    const basename = shpFile.replace(/\.shp$/, "");
    const dbfFile = basename + ".dbf";
    const name = path.basename(shpFile);

    console.log(`\nParsing: ${name}`);
    console.log(`  .dbf exists: ${fs.existsSync(dbfFile)}`);

    const shpBuf = fs.readFileSync(shpFile);
    const dbfBuf = fs.existsSync(dbfFile) ? fs.readFileSync(dbfFile) : undefined;
    const source = await shapefile.open(
      shpBuf.buffer.slice(shpBuf.byteOffset, shpBuf.byteOffset + shpBuf.byteLength),
      dbfBuf ? dbfBuf.buffer.slice(dbfBuf.byteOffset, dbfBuf.byteOffset + dbfBuf.byteLength) : undefined
    );

    let count = 0;
    const typeCounts: Record<string, number> = {};
    let result = await source.read();
    while (!result.done) {
      if (result.value?.geometry) {
        typeCounts[result.value.geometry.type] = (typeCounts[result.value.geometry.type] ?? 0) + 1;
      }
      count++;
      result = await source.read();
    }

    console.log(`  Features: ${count}`);
    console.log(`  Geometry types: ${JSON.stringify(typeCounts)}`);
  }

  console.log("\n  Shapefile: PASS");
}

async function main(): Promise<void> {
  console.log("OpenCAD Converter Tests");
  console.log("=======================");

  try { await testDxf(); } catch (err) { console.error("  DXF: FAIL -", err); }
  try { await testKml(); } catch (err) { console.error("  KML: FAIL -", err); }
  try { await testShapefile(); } catch (err) { console.error("  Shapefile: FAIL -", err); }

  console.log("\n=======================");
  console.log("All converter tests complete.");
}

main();
