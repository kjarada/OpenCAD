<div align="center">

# 🏗️ OpenCAD

**View and inspect CAD files directly in Visual Studio Code**

[![CI](https://github.com/opencad/opencad-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/opencad/opencad-vscode/actions/workflows/ci.yml)
[![Release](https://github.com/opencad/opencad-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/opencad/opencad-vscode/actions/workflows/release.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/opencad.opencad?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=opencad.opencad)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/opencad.opencad?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=opencad.opencad)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=opencad.opencad) · [Report Bug](https://github.com/opencad/opencad-vscode/issues) · [Request Feature](https://github.com/opencad/opencad-vscode/issues)

</div>

---

## Overview

**OpenCAD** brings native CAD file viewing to Visual Studio Code. Open IFC files directly in your editor with full 3D interactive visualization — no external software required.

Built for architects, engineers, and developers working with Building Information Modeling (BIM) data.

### Supported Formats

| Format | Standard | Status |
|--------|----------|--------|
| IFC | IFC 4x3 (ISO 16739-1:2024) | ✅ Supported |
| IFC | IFC 4 | ✅ Supported |
| IFC | IFC 2x3 | ✅ Supported |
| STEP | AP203/AP214 | 🔜 Planned |
| DXF | AutoCAD | 🔜 Planned |

## Features

- **🖥️ Native VS Code Integration** — Opens IFC files as a custom editor tab, just like any other file
- **🎮 Interactive 3D Viewer** — Orbit, pan, and zoom with mouse controls
- **📐 IFC 4x3 Support** — Full support for the latest IFC standard (ISO 16739-1:2024)
- **⚡ WASM-Powered** — Uses WebAssembly for fast, native-speed IFC parsing
- **🔧 Toolbar Controls** — Wireframe mode, camera reset, fit-to-view, projection toggle
- **🎨 Theme-Aware** — Adapts to your VS Code color theme
- **📊 Model Info** — Displays element count and file details
- **🪶 Lightweight** — No external dependencies or software required

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on macOS)
3. Search for **"OpenCAD"**
4. Click **Install**

### From Command Line

```bash
code --install-extension opencad.opencad
```

### From VSIX

Download the latest `.vsix` from [Releases](https://github.com/opencad/opencad-vscode/releases), then:

```bash
code --install-extension opencad-0.1.0.vsix
```

## Usage

### Open an IFC File

Simply open any `.ifc` file in VS Code — OpenCAD automatically activates and displays the 3D model.

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
| `OpenCAD: Open CAD Viewer` | Open a file picker to select a CAD file |
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
│   ├── extension.ts          # VS Code extension entry point
│   ├── ifcEditorProvider.ts   # Custom editor provider for IFC files
│   └── webview/
│       ├── main.ts            # Webview entry point & message handling
│       ├── viewer.ts          # Three.js scene, camera, IFC loading
│       └── toolbar.ts         # Toolbar button handlers
├── .github/workflows/
│   ├── ci.yml                 # CI: lint, build, test
│   └── release.yml            # Release: package, publish to Marketplace
└── assets/                    # Icons and static assets
```

### Technology Stack

- **[Three.js](https://threejs.org/)** — 3D rendering engine
- **[web-ifc](https://github.com/IFCjs/web-ifc)** — WebAssembly IFC parser
- **[web-ifc-three](https://github.com/IFCjs/web-ifc-three)** — Three.js IFC integration
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
git clone https://github.com/opencad/opencad-vscode.git
cd opencad-vscode

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
3. Open any `.ifc` file in the new VS Code window

### Building a VSIX Package

```bash
bun run package
```

## Release Process

Releases are automated via GitHub Actions:

1. **Create a version tag:**
   ```bash
   # Update version in package.json, then tag
   git tag v0.1.1

   # Push with tags
   git push origin main --tags
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

- [ ] **IFC Property Inspector** — View element properties in a sidebar panel
- [ ] **Element Selection** — Click to select and highlight individual elements
- [ ] **Section Planes** — Cut through the model with clipping planes
- [ ] **Measurement Tool** — Measure distances between points
- [ ] **STEP File Support** — View STEP/STP CAD files
- [ ] **DXF File Support** — View AutoCAD DXF files
- [ ] **Model Tree** — Hierarchical view of IFC spatial structure
- [ ] **Export Snapshots** — Export viewport as PNG/SVG
- [ ] **Multi-model** — Load and compare multiple IFC files

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [IFC.js](https://ifcjs.github.io/info/) — The open-source IFC toolkit that powers the parsing engine
- [Three.js](https://threejs.org/) — The 3D library that makes browser-based visualization possible
- [buildingSMART](https://www.buildingsmart.org/) — Maintainers of the IFC standard

---

<div align="center">

**Built with ❤️ for the AEC industry**

[⬆ Back to top](#-opencad)

</div>
