# Sample Files

Real-world test files for every supported format. Press **F5** in VS Code to launch the Extension Development Host, then open any file to test.

All samples are from authoritative, permissively-licensed sources (public domain, MIT, or equivalent) — see the source link next to each entry.

## IFC

IFC 4x3 samples from [buildingSMART Sample-Test-Files](https://github.com/buildingSMART/Sample-Test-Files) (MIT License).

| File | Description |
|------|-------------|
| `ifc/Building-Architecture.ifc` | Architectural building model |
| `ifc/Building-Structural.ifc`   | Structural building model |
| `ifc/Building-Hvac.ifc`         | HVAC building model |
| `ifc/Infra-Bridge.ifc`          | Infrastructure bridge model |
| `ifc/Infra-Road.ifc`            | Infrastructure road model |

## DXF

DXF samples from [mozman/ezdxf](https://github.com/mozman/ezdxf) (MIT License).

| File | Description |
|------|-------------|
| `dxf/uncommon.dxf` | Technical drawing with lines, dimensions, splines, polylines, arcs |
| `dxf/colors.dxf`   | Color and layer demonstration with circles, polylines, blocks |

## DWG

DWG sample from [GDAL autotest data](https://github.com/OSGeo/gdal/tree/master/autotest/ogr/data/cad) (MIT License).

Opened by GDAL's `libopencad` driver (shipped as `CAD` / "AutoCAD Driver" in gdal3.js).

| File | Description |
|------|-------------|
| `dwg/line_r2000.dwg` | AutoCAD 2000 format — minimal DWG with a single LineString entity |

## DGN

MicroStation DGN sample from [GDAL autotest data](https://github.com/OSGeo/gdal/tree/master/autotest/ogr/data/dgn) (MIT License).

| File | Description |
|------|-------------|
| `dgn/smalltest.dgn` | Small 2D Bentley MicroStation drawing used by GDAL's regression tests |

## KML / KMZ

| File | Source | Description |
|------|--------|-------------|
| `kml/KML_Samples.kml`                   | [Google KML Docs](https://developers.google.com/kml/documentation/) | Official KML reference: points, lines, polygons, styles |
| `kml/USGS_Earthquakes_2025-01-01.kml`   | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) | 60 real earthquake epicenters |
| `kmz/USGS_Earthquakes_2025-01-01.kmz`   | Same USGS data, packaged as KMZ | Demonstrates KMZ archive handling |

## Shapefile

Shapefiles from [Natural Earth](https://www.naturalearthdata.com/) (public domain).

| File | Description |
|------|-------------|
| `shp/ne_110m_admin_0_countries.*`           | World country boundaries (polygons) |
| `shp/ne_110m_rivers_lake_centerlines.*`     | Major world rivers (polylines) |
| `shp/ne_110m_lakes.*`                       | Major world lakes (polygons) |

## GeoJSON

| File | Source | Description |
|------|--------|-------------|
| `geojson/ne_110m_admin_0_countries.geojson` | [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) (public domain) | Same Natural Earth countries dataset, as GeoJSON |

## TopoJSON

| File | Source | Description |
|------|--------|-------------|
| `topojson/countries-110m.topojson` | [topojson/world-atlas](https://github.com/topojson/world-atlas) (ISC License) | Canonical TopoJSON world-atlas countries dataset, derived from Natural Earth |

## Esri File Geodatabase (.gdb)

`.gdb` is a **directory**, not a file. VS Code's file-based custom editor can't open directories, so OpenCAD registers a separate command for FileGDBs. To test:

- **Right-click** `samples/gdb/countries.gdb` in the Explorer → **Open File Geodatabase (.gdb)**, or
- Command Palette → **OpenCAD: Open File Geodatabase (.gdb)** → browse to the folder.

| Folder | Description |
|--------|-------------|
| `gdb/countries.gdb/` | 177 world-country polygons — generated from our Natural Earth shapefile via `ogr2ogr -f OpenFileGDB`. Exercises GDAL's `OpenFileGDB` driver and validates the directory-input pipeline. |

## GeoPackage

| File | Source | Description |
|------|--------|-------------|
| `gpkg/haiti_sample.gpkg` | [OGC GeoPackage](https://www.geopackage.org/) official sample (public domain) | Multi-layer GeoPackage used to validate GPKG v1.2 compliance |

## GPX

| File | Source | Description |
|------|--------|-------------|
| `gpx/fells_loop.gpx` | [Topografix](https://www.topografix.com/gpx.asp) — authors of the GPX spec (public) | Real hiking track through the Middlesex Fells Reservation, Massachusetts |

## FlatGeobuf

| File | Source | Description |
|------|--------|-------------|
| `fgb/countries.fgb` | [flatgeobuf/flatgeobuf](https://github.com/flatgeobuf/flatgeobuf) test data (BSD-2-Clause) | World countries — the canonical FlatGeobuf sample |

## GML

GML sample from [GDAL autotest data](https://github.com/OSGeo/gdal/tree/master/autotest/ogr/data/gml) (MIT License).

| File | Description |
|------|-------------|
| `gml/archsites.gml` + `archsites.xsd` | 25 archaeological site features (points) in UTM zone 13N, originally served by the GeoServer demo instance |

## MapInfo

Samples from [GDAL autotest data](https://github.com/OSGeo/gdal/tree/master/autotest/ogr/data/mitab) (MIT License).

| File | Description |
|------|-------------|
| `tab/all_geoms.*`                                  | Binary MapInfo TAB with all supported geometry types (`.tab` + `.dat` + `.id` + `.map`) |
| `mif/all_geoms.mif`                                | ASCII MIF version of the same geometries (no attributes — no `.mid` needed) |
| `mif/all_possible_fields.mif` + `all_possible_fields.mid` | MIF/MID demonstrating every MapInfo column type |
