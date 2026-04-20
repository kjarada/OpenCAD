import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type * as vscode from "vscode";
import type { ConversionResult, FormatConverter } from "./converter";
import type { GeometryData, LayerInfo } from "../types/geometry";
import { geojsonToEntities, computeBounds } from "./geoUtils";
import type { CoordMode } from "./geoUtils";
import type { FeatureCollection } from "geojson";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const initGdalJs = require("gdal3.js/node");

interface GdalDataset {
  pointer: number;
  path: string;
  type: string;
}

interface GdalFilePath {
  local: string;
  real: string;
}

interface Gdal {
  open(
    paths: string[],
    options?: string[],
    vfsHandlers?: string[]
  ): Promise<{ datasets: GdalDataset[]; errors: string[] }>;
  ogr2ogr(
    dataset: GdalDataset,
    options?: string[],
    outputName?: string
  ): Promise<GdalFilePath>;
  getFileBytes(filePath: GdalFilePath | string): Promise<Uint8Array>;
  getInfo(dataset: GdalDataset): Promise<{ driverName?: string; projectionWkt?: string }>;
  close(dataset: GdalDataset): Promise<void>;
}

/** CAD formats use planar CAD units (Z-up). Everything else is interpreted as geographic. */
const CARTESIAN_EXTS = new Set([".dxf", ".dgn", ".dwg"]);

/** Archive formats that wrap a primary vector file and need unpacking before GDAL can read them. */
const ARCHIVE_EXTS = new Set([".kmz"]);

/** Formats where the "file" is actually a directory of files — pass the directory path to GDAL. */
const DIRECTORY_EXTS = new Set([".gdb"]);

/**
 * Companion sidecar files that GDAL needs alongside the primary input.
 * Keyed by primary extension → list of companion extensions (with leading dot).
 */
const COMPANION_EXTS: Record<string, string[]> = {
  ".shp": [".dbf", ".prj", ".shx", ".cpg", ".sbn", ".sbx", ".shp.xml"],
  ".tab": [".dat", ".map", ".id", ".ind"],
  ".mif": [".mid"],
  ".gml": [".xsd", ".gfs"],
};

/** Short driver name → friendly label for metadata display. */
const DRIVER_FORMAT_NAMES: Record<string, string> = {
  DXF: "DXF (AutoCAD)",
  DGN: "DGN (MicroStation)",
  DGNV8: "DGN v8 (MicroStation)",
  CAD: "DWG (AutoCAD)",
  "AutoCAD Driver": "DWG (AutoCAD)",
  LIBKML: "KML",
  KML: "KML",
  "ESRI Shapefile": "Shapefile",
  GeoJSON: "GeoJSON",
  GeoJSONSeq: "GeoJSON (sequence)",
  TopoJSON: "TopoJSON",
  GPKG: "GeoPackage",
  GML: "GML",
  GPX: "GPX",
  FlatGeobuf: "FlatGeobuf",
  "MapInfo File": "MapInfo",
  CSV: "CSV",
  OSM: "OpenStreetMap",
  OpenFileGDB: "Esri File Geodatabase",
  SQLite: "SpatiaLite / SQLite",
  VRT: "OGR Virtual Format",
};

export class GdalConverter implements FormatConverter {
  readonly formatName = "CAD/GIS (GDAL)";
  readonly extensions = [
    // CAD
    ".dxf",
    ".dgn",
    ".dwg",
    // GIS: keyhole
    ".kml",
    ".kmz",
    // GIS: ESRI
    ".shp",
    // GIS: JSON family
    ".geojson",
    ".topojson",
    // GIS: containers & formats
    ".gpkg",
    ".gml",
    ".gpx",
    ".fgb",
    ".tab",
    ".mif",
    // GIS: directory-based containers (opened via explorer context menu)
    ".gdb",
  ];

  private gdalPromise: Promise<Gdal> | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private getGdal(): Promise<Gdal> {
    if (!this.gdalPromise) {
      const distDir = path.join(this.context.extensionPath, "dist");
      this.gdalPromise = initGdalJs({
        path: gdalConfigPath(distDir),
      }) as Promise<Gdal>;
    }
    return this.gdalPromise;
  }

  async convert(filePath: string): Promise<ConversionResult> {
    const ext = path.extname(filePath).toLowerCase();

    let inputPath = filePath;
    let tempFile: string | null = null;
    if (ARCHIVE_EXTS.has(ext)) {
      tempFile = await extractArchive(filePath, ext);
      inputPath = tempFile;
    }

    try {
      const gdal = await this.getGdal();

      // gdal3.js's mount helper splits paths on "/" only (not "\\"). On Windows, an
      // absolute path like "C:\\foo\\bar.dwg" therefore never splits, and the entire
      // string becomes the mounted filename while the mount root defaults to CWD —
      // producing "Assertion failed" errors inside the WASM FS. Normalize to forward
      // slashes so split('/') gives the real directory + filename.
      const inputs = collectInputPaths(inputPath).map(toPosix);
      const opened = await gdal.open(inputs);

      if (!opened.datasets || opened.datasets.length === 0) {
        const reason = opened.errors?.length ? opened.errors.join("; ") : "no datasets";
        throw new Error(`GDAL could not open ${path.basename(filePath)}: ${reason}`);
      }

      const dataset = opened.datasets[0];
      const info = await gdal
        .getInfo(dataset)
        .catch(() => ({} as { driverName?: string; projectionWkt?: string }));

      const mode: CoordMode = CARTESIAN_EXTS.has(ext) ? "cartesian" : "geographic";

      // For geographic data, reproject to WGS84 (EPSG:4326) when the source has a CRS,
      // so geojsonToEntities sees consistent [lon, lat] coordinates.
      const ogrOptions = ["-f", "GeoJSON", "-skipfailures"];
      if (mode === "geographic" && info.projectionWkt) {
        ogrOptions.push("-t_srs", "EPSG:4326");
      }

      let outputFile: GdalFilePath;
      try {
        outputFile = await gdal.ogr2ogr(dataset, ogrOptions);
      } finally {
        await gdal.close(dataset).catch(() => undefined);
      }

      const bytes = await gdal.getFileBytes(outputFile);
      const text = new TextDecoder("utf-8").decode(bytes);
      const fc = JSON.parse(text) as FeatureCollection;

      if (!fc.features || fc.features.length === 0) {
        throw new Error(`No features found in ${path.basename(filePath)}`);
      }

      const { entities, layerCounts } = geojsonToEntities(fc, { mode });
      const bounds = computeBounds(entities);

      const layerInfos: LayerInfo[] = [];
      for (const [name, count] of layerCounts) {
        layerInfos.push({ name, entityCount: count, visible: true });
      }

      const driverName = info.driverName ?? "";
      const formatLabel =
        DRIVER_FORMAT_NAMES[driverName] ?? driverName ?? ext.slice(1).toUpperCase();

      const metadata: Record<string, string> = {
        format: formatLabel,
        driver: driverName || "unknown",
        featureCount: String(fc.features.length),
        entityCount: String(entities.length),
      };
      if (info.projectionWkt) {
        metadata.projection = info.projectionWkt;
      }

      const data: GeometryData = {
        entities,
        bounds,
        layers: layerInfos,
        metadata,
        coordinateSystem: mode === "cartesian" ? "local" : "geographic",
      };

      return { kind: "geometry", data };
    } finally {
      if (tempFile) {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // ignore cleanup failure
        }
      }
    }
  }
}

/** Normalize a filesystem path to POSIX separators. Node's fs accepts forward slashes on Windows. */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Produce a `config.path` value for gdal3.js that survives its Node runtime quirks.
 *
 * gdal3.js's Node bundle ultimately calls `fs.readFileSync("./" + returnedPath)` to load
 * the packaged `.data` file (see `node_modules/gdal3.js/dist/package/gdal3.node.js`).
 * With an absolute Windows path like "c:/foo/dist/", `"./" + "c:/..."` is treated as
 * relative and resolved against `process.cwd()`, producing garbage like
 * `<vscode-install>/c:/foo/dist/...`. Passing a path *relative to process.cwd()*
 * works around that.
 */
function gdalConfigPath(distDir: string): string {
  const rel = path.relative(process.cwd(), distDir);
  if (path.isAbsolute(rel)) {
    // path.relative returns an absolute path when the drives differ on Windows.
    // gdal3.js's "./" prefix makes that unusable and there's no runtime workaround.
    throw new Error(
      `Cannot locate GDAL assets at ${distDir}: they are on a different drive than ` +
        `VS Code's working directory (${process.cwd()}). Install VS Code and OpenCAD on ` +
        `the same drive.`
    );
  }
  return rel.split(path.sep).join("/");
}

/**
 * Collect companion sidecar files so GDAL can resolve attributes, projection,
 * and indexes alongside the primary input.
 *
 * For directory-based formats (FileGDB), returns the directory path itself —
 * gdal3.js's open() mounts the parent and opens the directory as a single dataset.
 */
function collectInputPaths(filePath: string): string[] {
  const ext = path.extname(filePath).toLowerCase();
  if (DIRECTORY_EXTS.has(ext)) {
    return [filePath];
  }
  const companions = COMPANION_EXTS[ext];
  if (!companions) {
    return [filePath];
  }
  const base = filePath.slice(0, -ext.length);
  const paths = [filePath];
  for (const companion of companions) {
    const p = base + companion;
    if (p !== filePath && fs.existsSync(p)) {
      paths.push(p);
    }
  }
  return paths;
}

/**
 * Extract the primary payload from an archive format to a temp file.
 * Currently supports KMZ (extracts the primary KML entry).
 */
async function extractArchive(archivePath: string, ext: string): Promise<string> {
  if (ext !== ".kmz") {
    throw new Error(`Unsupported archive extension: ${ext}`);
  }

  const JSZip = (await import("jszip")).default;
  const buffer = fs.readFileSync(archivePath);
  const zip = await JSZip.loadAsync(buffer);

  const kmlNames = Object.keys(zip.files).filter((name) =>
    name.toLowerCase().endsWith(".kml")
  );
  if (kmlNames.length === 0) {
    throw new Error("No KML file found inside KMZ archive");
  }

  const primaryName = kmlNames.find((n) => n.toLowerCase() === "doc.kml") ?? kmlNames[0];
  const content = await zip.files[primaryName].async("nodebuffer");

  const tmp = path.join(os.tmpdir(), `opencad-${Date.now()}-${path.basename(primaryName)}`);
  fs.writeFileSync(tmp, content);
  return tmp;
}
