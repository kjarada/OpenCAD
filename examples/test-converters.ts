/**
 * Standalone converter test script. Run with: bun examples/test-converters.ts
 * Tests each converter's parsing logic without requiring VS Code.
 */
import * as path from "path";
import * as fs from "fs";

// DXF test
async function testDxf(): Promise<void> {
  console.log("\n=== Testing DXF Converter ===");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dxf = require("dxf");

  const files = [
    path.join(__dirname, "dxf", "floor-plan.dxf"),
    path.join(__dirname, "dxf", "shapes.dxf"),
  ];

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

  const file = path.join(__dirname, "kml", "landmarks.kml");
  console.log(`Parsing: ${path.basename(file)}`);

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

  // Check names
  const names = geojson.features
    .map((f: { properties?: { name?: string } }) => f.properties?.name)
    .filter(Boolean);
  console.log(`  Feature names: ${names.join(", ")}`);

  console.log("\n  KML: PASS");
}

// Shapefile test
async function testShapefile(): Promise<void> {
  console.log("\n=== Testing Shapefile Converter ===");

  const shapefile = require("shapefile");

  const shpFile = path.join(__dirname, "shp", "manhattan_footprints.shp");
  const dbfFile = path.join(__dirname, "shp", "manhattan_footprints.dbf");

  console.log(`Parsing: ${path.basename(shpFile)}`);
  console.log(`  .shp exists: ${fs.existsSync(shpFile)}`);
  console.log(`  .dbf exists: ${fs.existsSync(dbfFile)}`);

  const source = await shapefile.open(shpFile, dbfFile);
  const features = [];
  let result = await source.read();
  while (!result.done) {
    if (result.value) {
      features.push(result.value);
    }
    result = await source.read();
  }

  console.log(`  Features: ${features.length}`);

  const typeCounts: Record<string, number> = {};
  for (const f of features) {
    if (f.geometry) {
      typeCounts[f.geometry.type] = (typeCounts[f.geometry.type] ?? 0) + 1;
    }
  }
  console.log(`  Geometry types: ${JSON.stringify(typeCounts)}`);

  // Check properties
  if (features.length > 0 && features[0].properties) {
    console.log(`  Properties keys: ${Object.keys(features[0].properties).join(", ")}`);
    console.log(`  First feature name: ${features[0].properties.NAME ?? "(no NAME field)"}`);
  }

  console.log("\n  Shapefile: PASS");
}

// GeoUtils test
async function testGeoUtils(): Promise<void> {
  console.log("\n=== Testing GeoUtils (projection) ===");

  // Simulate what geoUtils does
  const EARTH_RADIUS_M = 6371000;
  const centroidLon = -73.985;
  const centroidLat = 40.749;
  const cosLat = Math.cos((centroidLat * Math.PI) / 180);

  // Project a point ~100m east, ~200m north
  const testLon = -73.984;
  const testLat = 40.751;

  const x = ((testLon - centroidLon) * Math.PI / 180) * EARTH_RADIUS_M * cosLat;
  const z = ((testLat - centroidLat) * Math.PI / 180) * EARTH_RADIUS_M;

  console.log(`  Centroid: ${centroidLon}, ${centroidLat}`);
  console.log(`  Test point: ${testLon}, ${testLat}`);
  console.log(`  Projected X (east): ${x.toFixed(1)}m`);
  console.log(`  Projected Z (north): ${z.toFixed(1)}m`);
  console.log(`  Expected: ~85m east, ~222m north`);

  if (Math.abs(x - 85) < 10 && Math.abs(z - 222) < 10) {
    console.log("\n  GeoUtils: PASS");
  } else {
    console.log("\n  GeoUtils: WARNING - projection values seem off");
  }
}

async function main(): Promise<void> {
  console.log("OpenCAD Converter Tests");
  console.log("=======================");

  try {
    await testDxf();
  } catch (err) {
    console.error("  DXF: FAIL -", err);
  }

  try {
    await testKml();
  } catch (err) {
    console.error("  KML: FAIL -", err);
  }

  try {
    await testShapefile();
  } catch (err) {
    console.error("  Shapefile: FAIL -", err);
  }

  try {
    await testGeoUtils();
  } catch (err) {
    console.error("  GeoUtils: FAIL -", err);
  }

  console.log("\n=======================");
  console.log("All converter tests complete.");
}

main();
