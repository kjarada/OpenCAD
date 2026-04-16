import type { ConversionResult, FormatConverter } from "./converter";
import { IfcConvertManager } from "../ifcConvertManager";
import type * as vscode from "vscode";

export class IfcConverter implements FormatConverter {
  readonly formatName = "IFC";
  readonly extensions = [".ifc"];
  private readonly ifcConvert: IfcConvertManager;

  constructor(context: vscode.ExtensionContext) {
    this.ifcConvert = new IfcConvertManager(context);
  }

  async convert(filePath: string): Promise<ConversionResult> {
    const data = await this.ifcConvert.convertToGlb(filePath);
    return { kind: "glb", data };
  }
}
