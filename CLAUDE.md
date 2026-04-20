# OpenCAD — Claude Code Instructions

## Project

OpenCAD is a VS Code extension that views CAD and GIS files with interactive 3D visualization. Supported formats:

- **BIM**: IFC (4x3 / 4 / 2x3) — via IfcConvert → GLB
- **CAD**: DXF, DWG, DGN — via GDAL/OGR (`DXF`, `CAD`/libopencad, `DGN` drivers)
- **GIS vector**: KML, KMZ, Shapefile (`.shp`), GeoJSON, TopoJSON, GeoPackage (`.gpkg`), Esri File Geodatabase (`.gdb`), GML, GPX, FlatGeobuf (`.fgb`), MapInfo TAB/MIF — all via GDAL/OGR.

## Critical Rules

1. **Bun only** — This project exclusively uses Bun as the package manager and script runner. Never use npm, yarn, pnpm, or npx. Use `bun install`, `bun run <script>`, `bun x <package>`.
2. **No `any`** — TypeScript strict mode is enabled. Avoid `any`; use proper types or `unknown` with type guards.
3. **Two contexts** — Extension host (Node.js) and webview (browser) are separate. They communicate only via `postMessage`. Never import `vscode` in webview code. Never import `three` in extension host code.
4. **CSP required** — All webview HTML must include Content-Security-Policy with nonces. Use `webview.cspSource` for allowed origins.
5. **Conventional Commits** — All commit messages follow the format: `type(scope): description`.

## Architecture

```
src/
├── extension.ts            ← VS Code extension entry (Node.js)
├── cadEditorProvider.ts    ← Custom editor: detects format, delegates to converter, creates webview
├── ifcConvertManager.ts    ← Downloads & runs IfcConvert binary (IFC → GLB)
├── types/
│   ├── geometry.ts         ← Shared geometry types (GeometryData, GeometryEntity, etc.)
│   └── messages.ts         ← Message protocol types (extension ↔ webview)
├── converters/
│   ├── converter.ts        ← FormatConverter interface, ConversionResult union
│   ├── converterRegistry.ts← Maps file extensions → converter instances
│   ├── ifcConverter.ts     ← IFC → GLB via IfcConvert binary
│   ├── gdalConverter.ts    ← Vector CAD/GIS → GeoJSON (via gdal3.js ogr2ogr) → GeometryData
│   └── geoUtils.ts         ← GeoJSON → GeometryEntities (geographic or cartesian projection)
└── webview/
    ├── main.ts             ← Webview entry: handles loadGlb + loadGeometry messages
    ├── viewer.ts           ← Three.js scene, GLB + geometry loading
    ├── geometryRenderer.ts ← Converts GeometryData → Three.js objects
    └── toolbar.ts          ← UI button handlers
```

### Data Flow

Two rendering paths through one unified editor provider:

```
IFC:                 .ifc → IfcConverter (IfcConvert binary) → GLB → GLTFLoader → Three.js
CAD (cartesian):     .dxf / .dwg / .dgn → GdalConverter → GeoJSON → GeometryData (cartesian, Z-up → Y-up) → GeometryRenderer → Three.js
GIS (geographic):    .kml / .kmz / .shp / .geojson / .topojson / .gpkg / .gdb / .gml / .gpx / .fgb / .tab / .mif
                     → GdalConverter (reproject to EPSG:4326) → GeoJSON → GeometryData (geographic) → GeometryRenderer → Three.js
```

**Input shape handling in `GdalConverter`:**
- **Archive formats** (`.kmz` — `ARCHIVE_EXTS`): unpacked via JSZip to a temp file before opening.
- **Companion-file formats** (`.shp`, `.tab`, `.mif`, `.gml` — `COMPANION_EXTS`): sidecars auto-discovered next to the primary file (`.dbf`/`.prj`/`.shx`, `.dat`/`.map`, `.mid`, `.xsd`) and passed to `gdal.open()` together.
- **Directory-based formats** (`.gdb` — `DIRECTORY_EXTS`): the directory path itself is passed to `gdal.open()` — gdal3.js's Emscripten FS mounts the parent and `GDALOpenEx` recognises the `.gdb` folder as a single dataset. Because VS Code custom editors only trigger on files, FileGDBs are reached via the `opencad.openGeodatabase` command wired to the Explorer context menu (`resourceExtname == .gdb`).

### GDAL integration

- `gdal3.js` is a WebAssembly port of GDAL. It runs in the extension host (Node.js).
- `GdalConverter` initializes it lazily, pointing at the WASM + data files copied into `dist/` by `copy-webpack-plugin`.
- `ogr2ogr` is called with `-f GeoJSON -skipfailures` to produce an in-memory GeoJSON, which is then read back via `getFileBytes` and piped through `geojsonToEntities`. For geographic inputs that have a CRS, `-t_srs EPSG:4326` is added so coordinates are normalized to lon/lat before projection.
- Coordinate interpretation is chosen per extension: CAD formats (`.dxf`, `.dwg`, `.dgn` — `CARTESIAN_EXTS`) are treated as cartesian with CAD Z-up → Three.js Y-up; all other GIS formats are treated as geographic and projected via equirectangular around the dataset centroid.
- Add a new format by appending its extension to `GdalConverter.extensions`, optionally registering sidecar companions in `COMPANION_EXTS`, a driver label in `DRIVER_FORMAT_NAMES`, and a filename pattern in `package.json`'s `customEditors.selector`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript 5+ (strict) |
| Bundler | Webpack 5 (dual config) + copy-webpack-plugin for GDAL WASM assets |
| 3D | Three.js (GLTFLoader + GeometryRenderer) |
| IFC Engine | IfcOpenShell IfcConvert (C++ binary, downloaded on first use) |
| Vector CAD/GIS | gdal3.js (GDAL/OGR compiled to WASM) |
| KMZ extraction | jszip |
| Lint | ESLint + @typescript-eslint |
| CI | GitHub Actions + oven-sh/setup-bun |

## Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install all dependencies |
| `bun run build` | Production webpack build |
| `bun run watch` | Development build with file watching |
| `bun run dev` | One-time development build |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run package` | Package as .vsix |

## Style

- Prefer `const`; use `let` only when reassignment is needed
- No default exports — use named exports
- Functions should do one thing
- Error messages should be user-friendly (shown via `vscode.window.showErrorMessage`)
- Use `vscode.Uri` for all file path operations in the extension host
- Resource URIs in webview must go through `webview.asWebviewUri()`

## Testing

Press `F5` in VS Code to launch Extension Development Host with the extension loaded. Open any supported file (`.ifc`, `.dxf`, `.dwg`, `.dgn`, `.kml`, `.kmz`, `.shp`, `.geojson`, `.topojson`, `.gpkg`, `.gml`, `.gpx`, `.fgb`, `.tab`, `.mif`) to test. For File Geodatabases (`.gdb` folders), right-click the folder in the Explorer and pick **OpenCAD: Open File Geodatabase**.

## Security

- Webview content is sandboxed; CSP prevents inline scripts (except via nonce)
- GLB data is transferred as `Uint8Array` — no eval or dynamic code execution
- IfcConvert binary is downloaded from official IfcOpenShell GitHub releases
- Binary is cached in `context.globalStorageUri` (VS Code global storage)
- The extension requires internet on first use to download IfcConvert (~20 MB)
- gdal3.js WASM + data files (~40 MB) ship inside the extension package; no runtime download needed
