# OpenCAD — Claude Code Instructions

## Project

OpenCAD is a VS Code extension that views CAD and GIS files with interactive 3D visualization. Supported formats: IFC (4x3/4/2x3), DXF, DWG (experimental), KML/KMZ, and Shapefiles.

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
│   ├── messages.ts         ← Message protocol types (extension ↔ webview)
│   ├── togeojson.d.ts      ← Type declaration for @mapbox/togeojson
│   └── shapefile.d.ts      ← Type declaration for shapefile
├── converters/
│   ├── converter.ts        ← FormatConverter interface, ConversionResult union
│   ├── converterRegistry.ts← Maps file extensions → converter instances
│   ├── ifcConverter.ts     ← IFC → GLB via IfcConvert binary
│   ├── dxfConverter.ts     ← DXF → GeometryData via dxf npm
│   ├── dwgConverter.ts     ← DWG (experimental, suggests DXF export)
│   ├── kmlConverter.ts     ← KML/KMZ → GeoJSON → GeometryData
│   ├── shapefileConverter.ts← SHP → GeoJSON → GeometryData
│   └── geoUtils.ts         ← Geographic projection + GeoJSON → geometry conversion
└── webview/
    ├── main.ts             ← Webview entry: handles loadGlb + loadGeometry messages
    ├── viewer.ts           ← Three.js scene, GLB + geometry loading
    ├── geometryRenderer.ts ← Converts GeometryData → Three.js objects
    └── toolbar.ts          ← UI button handlers
```

### Data Flow

Two rendering paths through one unified editor provider:

```
IFC:  User opens .ifc → IfcConverter (IfcConvert binary) → GLB bytes → GLTFLoader → Three.js
DXF:  User opens .dxf → DxfConverter (dxf npm parser)    → GeometryData → GeometryRenderer → Three.js
KML:  User opens .kml → KmlConverter (togeojson + xmldom) → GeometryData → GeometryRenderer → Three.js
KMZ:  User opens .kmz → KmlConverter (jszip + togeojson)  → GeometryData → GeometryRenderer → Three.js
SHP:  User opens .shp → ShpConverter (shapefile npm)      → GeometryData → GeometryRenderer → Three.js
DWG:  User opens .dwg → DwgConverter (experimental)       → Error with guidance to export DXF
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript 5+ (strict) |
| Bundler | Webpack 5 (dual config) |
| 3D | Three.js (GLTFLoader + GeometryRenderer) |
| IFC Engine | IfcOpenShell IfcConvert (C++ binary) |
| DXF Parser | dxf npm package |
| GIS Parsers | @mapbox/togeojson, shapefile, jszip |
| XML Parser | @xmldom/xmldom |
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

Press `F5` in VS Code to launch Extension Development Host with the extension loaded. Open any `.ifc`, `.dxf`, `.kml`, `.kmz`, or `.shp` file to test.

## Security

- Webview content is sandboxed; CSP prevents inline scripts (except via nonce)
- GLB data is transferred as `Uint8Array` — no eval or dynamic code execution
- IfcConvert binary is downloaded from official IfcOpenShell GitHub releases
- Binary is cached in `context.globalStorageUri` (VS Code global storage)
- The extension requires internet on first use to download IfcConvert (~20 MB)
