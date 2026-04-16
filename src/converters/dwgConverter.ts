import type { ConversionResult, FormatConverter } from "./converter";

export class DwgConverter implements FormatConverter {
  readonly formatName = "DWG (Experimental)";
  readonly extensions = [".dwg"];

  async convert(_filePath: string): Promise<ConversionResult> {
    // DWG is a proprietary binary format. Full support requires either:
    // - libredwg-web WASM (experimental, may not support all DWG versions)
    // - ODA File Converter (requires separate installation)
    //
    // For now, provide a clear error message guiding users to export as DXF.
    throw new Error(
      "DWG support is experimental and not yet fully implemented. " +
      "For best results, please export your file as DXF from your CAD software " +
      "(e.g., AutoCAD: SAVEAS → DXF), then open the DXF file in OpenCAD."
    );
  }
}
