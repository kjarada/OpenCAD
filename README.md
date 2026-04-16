<div align="center">

# 🏗️ OpenCAD

**View and inspect CAD/GIS files directly in Visual Studio Code**

[![CI](https://github.com/kjarada/OpenCAD/actions/workflows/ci.yml/badge.svg)](https://github.com/kjarada/OpenCAD/actions/workflows/ci.yml)
[![Release](https://github.com/kjarada/OpenCAD/actions/workflows/release.yml/badge.svg)](https://github.com/kjarada/OpenCAD/actions/workflows/release.yml)
[![VS Code Marketplace](https://vsmarketplacebadges.dev/version-short/kamaljarada.opencad.svg?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=kamaljarada.opencad)
[![Downloads](https://vsmarketplacebadges.dev/downloads-short/kamaljarada.opencad.svg)](https://marketplace.visualstudio.com/items?itemName=kamaljarada.opencad)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=kamaljarada.opencad) · [Report Bug](https://github.com/kjarada/OpenCAD/issues) · [Request Feature](https://github.com/kjarada/OpenCAD/issues)

</div>

---

## Overview

**OpenCAD** brings native CAD and GIS file viewing to Visual Studio Code. Open IFC, DXF, KML, KMZ, and Shapefile files directly in your editor with full 3D interactive visualization — no external software required.

Built for architects, engineers, GIS professionals, and developers working with Building Information Modeling (BIM) and geospatial data.

### Supported Formats

| Format | Standard | Status |
|--------|----------|--------|
| IFC | IFC 4x3 (ISO 16739-1:2024) | ✅ Supported |
| IFC | IFC 4 / IFC 2x3 | ✅ Supported |
| DXF | AutoCAD Drawing Exchange Format | ✅ Supported |
| KML | Keyhole Markup Language (Google Earth) | ✅ Supported |
| KMZ | Compressed KML | ✅ Supported |
| Shapefile | ESRI Shapefile (.shp) | ✅ Supported |
| DWG | AutoCAD Drawing | 🧪 Experimental |
| STEP | AP203/AP214 | 🔜 Planned |

## Features

- **🖥️ Native VS Code Integration** — Opens CAD/GIS files as a custom editor tab, just like any other file
- **🎮 Interactive 3D Viewer** — Orbit, pan, and zoom with mouse controls
- **📐 Multi-Format Support** — IFC, DXF, KML/KMZ, Shapefiles — one extension for all your CAD and GIS files
- **🔩 IfcOpenShell Powered** — Uses the battle-tested IfcOpenShell C++ geometry engine for IFC parsing
- **🗂️ Layer Support** — DXF layers and GIS feature attributes preserved with correct colors
- **🌍 Geographic Projection** — KML/KMZ and Shapefile coordinates automatically projected from lat/lon to local 3D space
- **🔧 Toolbar Controls** — Wireframe mode, camera reset, fit-to-view, projection toggle
- **🎨 Theme-Aware** — Adapts to your VS Code color theme
- **📊 Model Info** — Displays element count and file details
- **🪶 Lightweight** — IFC conversion auto-downloads IfcConvert on first use (~20 MB, one-time); all other formats need zero external dependencies

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on macOS)
3. Search for **"OpenCAD"**
4. Click **Install**

### From Command Line

```bash
code --install-extension kamaljarada.opencad
```

### From VSIX

Download the latest `.vsix` from [Releases](https://github.com/kjarada/OpenCAD/releases), then:

```bash
code --install-extension opencad-*.vsix
```

## Usage

### Open a File

Simply open any `.ifc`, `.dxf`, `.dwg`, `.kml`, `.kmz`, or `.shp` file in VS Code — OpenCAD automatically activates and displays the 3D visualization.

### Format Notes

| Format | Notes |
|--------|-------|
| **IFC** | Requires one-time download of IfcConvert binary (~20 MB). Supports IFC 2x3, IFC 4, and IFC 4x3. |
| **DXF** | Supports LINE, POLYLINE, CIRCLE, ARC, TEXT, ELLIPSE, SPLINE, 3DFACE, SOLID, and INSERT/BLOCK references. Layer colors preserved. |
| **KML/KMZ** | Points rendered as markers, LineStrings as paths, Polygons as filled shapes. Coordinates projected from WGS84 to local meters. |
| **Shapefile** | Reads .shp + .dbf (attributes) + .prj (projection). Works without .dbf (geometry only). |
| **DWG** | Experimental — currently shows guidance to export as DXF from your CAD software for best results. |

### Viewer Controls

| Action | Mouse | Keyboard |
|--------|-------|----------|
| Orbit | Left-click + drag | — |
| Pan | Right-click + drag | — |
| Zoom | Scroll wheel | — |
| Fit to View | — | Toolbar ⊞ button |
| Toggle Wireframe | — | Toolbar ◻ button |
| Reset Camera | — | Toolbar ⟳ button |

### Commands

Open the Command Palette (`Ctrl+Shift+P`) and type "OpenCAD":

| Command | Description |
|---------|-------------|
| `OpenCAD: Open CAD Viewer` | Open a file picker to select a CAD/GIS file |
| `OpenCAD: Reset Camera` | Reset the camera to the default position |
| `OpenCAD: Toggle Wireframe` | Toggle wireframe rendering mode |
| `OpenCAD: Fit Model to View` | Fit the entire model in the viewport |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `opencad.defaultBackground` | `#1e1e2e` | Background color for the 3D viewport |
| `opencad.showGrid` | `true` | Show grid in the viewport |
| `opencad.showAxes` | `true` | Show axes helper |
| `opencad.defaultProjection` | `perspective` | Camera projection (`perspective` or `orthographic`) |

## Architecture

```
OpenCAD
├── src/
│   ├── extension.ts              # VS Code extension entry point
│   ├── cadEditorProvider.ts      # Unified custom editor for all formats
│   ├── ifcConvertManager.ts      # Downloads & runs IfcConvert binary
│   ├── types/                    # Shared type definitions
│   │   └── geometry.ts           # GeometryData, GeometryEntity types
│   ├── converters/               # Format-specific converters
│   │   ├── converter.ts          # FormatConverter interface
│   │   ├── converterRegistry.ts  # Extension → converter mapping
│   │   ├── ifcConverter.ts       # IFC → GLB (via IfcConvert)
│   │   ├── dxfConverter.ts       # DXF → GeometryData (via dxf npm)
│   │   ├── kmlConverter.ts       # KML/KMZ → GeometryData
│   │   ├── shapefileConverter.ts # Shapefile → GeometryData
│   │   └── geoUtils.ts           # Geographic projection utilities
│   └── webview/
│       ├── main.ts               # Webview entry & message handling
│       ├── viewer.ts             # Three.js scene, GLB + geometry loading
│       ├── geometryRenderer.ts   # GeometryData → Three.js objects
│       └── toolbar.ts            # Toolbar button handlers
├── examples/                     # Sample files for each format
├── .github/workflows/
│   ├── ci.yml                    # CI: lint, build, test
│   └── release.yml               # Release: package, publish
└── assets/                       # Icons and static assets
```

### How It Works

OpenCAD uses a **converter abstraction** with two rendering paths:

**IFC path:**
1. User opens `.ifc` file → Extension downloads [IfcConvert](https://github.com/IfcOpenShell/IfcOpenShell) (one-time)
2. IfcConvert converts IFC to GLB (binary glTF)
3. GLB data sent to webview → Three.js `GLTFLoader` renders the 3D model

**Geometry path (DXF, KML, Shapefile):**
1. User opens file → Extension parses with format-specific npm library
2. Parsed data converted to intermediate `GeometryData` (lines, polygons, arcs, circles, text)
3. For GIS formats, coordinates projected from lat/lon to local Cartesian (meters)
4. `GeometryData` sent to webview → `GeometryRenderer` builds Three.js objects

### Technology Stack

- **[IfcOpenShell](https://ifcopenshell.org/)** — C++ IFC geometry engine (via IfcConvert CLI)
- **[Three.js](https://threejs.org/)** — 3D rendering engine
- **[dxf](https://github.com/skymakerolof/dxf)** — DXF file parser
- **[@mapbox/togeojson](https://github.com/mapbox/togeojson)** — KML/GPX to GeoJSON converter
- **[shapefile](https://github.com/mbostock/shapefile)** — Shapefile parser
- **[Webpack](https://webpack.js.org/)** — Module bundling for extension and webview
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe development
- **[Bun](https://bun.sh/)** — Fast JavaScript runtime and package manager

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [VS Code](https://code.visualstudio.com/) >= 1.85.0

### Setup

```bash
# Clone the repository
git clone https://github.com/kjarada/OpenCAD.git
cd OpenCAD

# Install dependencies
bun install

# Build the extension
bun run build

# Watch for changes during development
bun run watch
```

### Running Locally

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open any `.ifc`, `.dxf`, `.kml`, `.kmz`, or `.shp` file in the new VS Code window

### Running Tests

```bash
# Test converter parsing (requires bun)
bun examples/test-converters.ts

# Test full converter pipeline
bun examples/test-full-pipeline.ts

# Test edge cases
bun examples/test-edge-cases.ts
```

### Building a VSIX Package

```bash
bun run package
```

## Release Process

Releases are automated via GitHub Actions:

1. **Create a version tag:**
   ```bash
   # Update version in package.json, then tag
   git tag v0.3.0

   # Push with tags
   git push origin master --tags
   ```

2. **Automated pipeline:**
   - Builds and lints the project
   - Packages the `.vsix` extension
   - Creates a GitHub Release with release notes
   - Publishes to the VS Code Marketplace
   - Publishes to Open VSX Registry

### Setting Up Publishing

To enable automated publishing, add these secrets to your GitHub repository:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `VSCE_PAT` | VS Code Marketplace Personal Access Token | [Create PAT](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) |
| `OVSX_PAT` | Open VSX Registry Token (optional) | [Create Token](https://open-vsx.org/) |

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Roadmap

- [x] **DXF File Support** — View AutoCAD DXF files with layer support
- [x] **KML/KMZ Support** — View Google Earth geospatial data
- [x] **Shapefile Support** — View ESRI Shapefile GIS data
- [ ] **DWG File Support** — Native DWG parsing (currently experimental)
- [ ] **IFC Property Inspector** — View element properties in a sidebar panel
- [ ] **Element Selection** — Click to select and highlight individual elements
- [ ] **Layer Toggle** — Show/hide individual layers in DXF and GIS files
- [ ] **Section Planes** — Cut through the model with clipping planes
- [ ] **Measurement Tool** — Measure distances between points
- [ ] **STEP File Support** — View STEP/STP CAD files
- [ ] **Model Tree** — Hierarchical view of IFC spatial structure
- [ ] **Export Snapshots** — Export viewport as PNG/SVG
- [ ] **Multi-model** — Load and compare multiple files

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [IfcOpenShell](https://ifcopenshell.org/) — The open-source C++ IFC geometry engine that powers IFC conversion
- [Three.js](https://threejs.org/) — The 3D library that makes browser-based visualization possible
- [buildingSMART](https://www.buildingsmart.org/) — Maintainers of the IFC standard
- [dxf](https://github.com/skymakerolof/dxf) — DXF parser for Node.js/browser
- [@mapbox/togeojson](https://github.com/mapbox/togeojson) — KML to GeoJSON conversion
- [shapefile](https://github.com/mbostock/shapefile) — Shapefile to GeoJSON conversion

---

<div align="center">

**Built with ❤️ for the AEC and GIS industries**

[⬆ Back to top](#-opencad)

</div>
