import type { FormatConverter } from "./converter";
import { IfcConverter } from "./ifcConverter";
import { GdalConverter } from "./gdalConverter";
import type * as vscode from "vscode";

let registry: Map<string, FormatConverter> | null = null;

export function initConverterRegistry(context: vscode.ExtensionContext): void {
  registry = new Map<string, FormatConverter>();

  const converters: FormatConverter[] = [
    new IfcConverter(context),
    new GdalConverter(context),
  ];

  for (const converter of converters) {
    for (const ext of converter.extensions) {
      registry.set(ext, converter);
    }
  }
}

export function getConverter(extension: string): FormatConverter | undefined {
  if (!registry) {
    throw new Error("Converter registry not initialized. Call initConverterRegistry first.");
  }
  return registry.get(extension.toLowerCase());
}
