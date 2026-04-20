# Changelog

All notable changes to the **OpenCAD** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-04-20

### Added
- Native DWG support via GDAL's `CAD` (libopencad) driver — opens AutoCAD files directly; no DXF export step required.
- Esri File Geodatabase (`.gdb`) support via GDAL's `OpenFileGDB` driver. Because `.gdb` is a directory, it's opened through the **OpenCAD: Open File Geodatabase** command wired to the Explorer context menu on `*.gdb` folders.
- DGN (MicroStation) support via GDAL's `DGN` driver.
- GeoJSON, TopoJSON, GeoPackage (`.gpkg`), GML, GPX, FlatGeobuf (`.fgb`), and MapInfo TAB/MIF support — all via the same GDAL/OGR pipeline.
- Automatic reprojection to WGS84 (EPSG:4326) for geographic inputs with a declared CRS, so projected source data renders with correct lon/lat coordinates.
- Sidecar auto-discovery for MapInfo TAB/MIF and GML (in addition to the existing Shapefile handling).
- Real-world sample files for every supported format under [`samples/`](./samples/), sourced from Natural Earth, GDAL autotest, OGC, and other authoritative datasets.

### Changed
- Consolidated format-specific converters (`dxfConverter`, `kmlConverter`, `shapefileConverter`, `dwgConverter`) into a single `gdalConverter` powered by `gdal3.js` (GDAL compiled to WebAssembly).

### Fixed
- gdal3.js asset loading on Windows: the absolute-path form of `config.paths.{wasm,data}` collides with gdal3.js's internal prefix logic. Switched to `config.path` (directory, relative to `process.cwd()`) so the `"./"` prefix used by gdal3.js's Node data loader resolves correctly.
- Windows path handling in `gdal.open()`: backslashed absolute paths are now normalized to forward slashes before being passed to gdal3.js, whose `mount` helper only splits on `/`. Previously, backslashed paths mounted the extension-host CWD (VS Code's install directory) instead of the file's real directory, producing WASM assertion failures.

## [0.1.0] - 2024-XX-XX

### Added
- First public release
- Custom editor for `.ifc` files
- Three.js-based 3D viewport
- WASM-powered IFC parsing via web-ifc
- Commands: Open Viewer, Reset Camera, Toggle Wireframe, Fit to View
- Configuration: background color, grid, axes, projection mode

[Unreleased]: https://github.com/kjarada/OpenCAD/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/kjarada/OpenCAD/releases/tag/v0.4.0
[0.1.0]: https://github.com/kjarada/OpenCAD/releases/tag/v0.1.0
