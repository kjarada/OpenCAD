import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { ExecFileException, execFile } from "child_process";

const IFCCONVERT_VERSION = "0.8.5";

interface PlatformInfo {
  archiveUrl: string;
  binaryName: string;
  archiveSuffix: string;
}

function getPlatformInfo(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();

  const base = `https://github.com/IfcOpenShell/IfcOpenShell/releases/download/ifcconvert-${IFCCONVERT_VERSION}`;

  if (platform === "win32") {
    return {
      archiveUrl: `${base}/ifcconvert-${IFCCONVERT_VERSION}-win64.zip`,
      binaryName: "IfcConvert.exe",
      archiveSuffix: "win64",
    };
  } else if (platform === "darwin") {
    const suffix = arch === "arm64" ? "macosm164" : "macos64";
    return {
      archiveUrl: `${base}/ifcconvert-${IFCCONVERT_VERSION}-${suffix}.zip`,
      binaryName: "IfcConvert",
      archiveSuffix: suffix,
    };
  } else {
    return {
      archiveUrl: `${base}/ifcconvert-${IFCCONVERT_VERSION}-linux64.zip`,
      binaryName: "IfcConvert",
      archiveSuffix: "linux64",
    };
  }
}

export class IfcConvertManager {
  private binDir: string;
  private binaryPath: string | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.binDir = path.join(context.globalStorageUri.fsPath, "ifcconvert", IFCCONVERT_VERSION);
  }

  async ensureBinary(): Promise<string> {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      return this.binaryPath;
    }

    const info = getPlatformInfo();
    const expectedPath = path.join(this.binDir, info.binaryName);

    if (fs.existsSync(expectedPath)) {
      this.binaryPath = expectedPath;
      return expectedPath;
    }

    // Download with progress
    const binaryPath = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "OpenCAD: Downloading IfcConvert...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading..." });
        return this.downloadAndExtract(info);
      }
    );

    this.binaryPath = binaryPath;
    return binaryPath;
  }

  private async downloadAndExtract(info: PlatformInfo): Promise<string> {
    fs.mkdirSync(this.binDir, { recursive: true });

    const zipPath = path.join(this.binDir, `ifcconvert-${info.archiveSuffix}.zip`);

    // Download the zip file
    const response = await fetch(info.archiveUrl, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to download IfcConvert: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));

    // Extract using VS Code's built-in capability or system tools
    await this.extractZip(zipPath, this.binDir);

    // Clean up zip
    try {
      fs.unlinkSync(zipPath);
    } catch {
      // ignore cleanup failure
    }

    const binaryPath = path.join(this.binDir, info.binaryName);

    if (!fs.existsSync(binaryPath)) {
      // The zip might extract into a subdirectory — search for it
      const found = this.findBinary(this.binDir, info.binaryName);
      if (found) {
        return found;
      }
      throw new Error(`IfcConvert binary not found after extraction at ${binaryPath}`);
    }

    // Make executable on Unix
    if (os.platform() !== "win32") {
      fs.chmodSync(binaryPath, 0o755);
    }

    return binaryPath;
  }

  private findBinary(dir: string, name: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === name) {
        if (os.platform() !== "win32") {
          fs.chmodSync(fullPath, 0o755);
        }
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = this.findBinary(fullPath, name);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    const platform = os.platform();

    return new Promise<void>((resolve, reject) => {
      if (platform === "win32") {
        // Use PowerShell to extract
        execFile(
          "powershell",
          ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`],
          { timeout: 60000 },
          (error: ExecFileException | null) => {
            if (error) {
              reject(new Error(`Failed to extract zip: ${error.message}`));
            } else {
              resolve();
            }
          }
        );
      } else {
        // Use unzip on Unix
        execFile("unzip", ["-o", zipPath, "-d", destDir], { timeout: 60000 }, (error: ExecFileException | null) => {
          if (error) {
            reject(new Error(`Failed to extract zip: ${error.message}`));
          } else {
            resolve();
          }
        });
      }
    });
  }

  async convertToGlb(ifcPath: string): Promise<Buffer> {
    const binaryPath = await this.ensureBinary();
    const tmpDir = os.tmpdir();
    const glbPath = path.join(tmpDir, `opencad-${Date.now()}.glb`);

    return new Promise<Buffer>((resolve, reject) => {
      execFile(
        binaryPath,
        [ifcPath, glbPath],
        { timeout: 120000 },
        (error: ExecFileException | null, _stdout: string, stderr: string) => {
          if (error) {
            // Clean up temp file on error
            try { fs.unlinkSync(glbPath); } catch { /* ignore */ }
            reject(new Error(`IfcConvert failed: ${stderr || error.message}`));
            return;
          }

          try {
            const data = fs.readFileSync(glbPath);
            fs.unlinkSync(glbPath);
            resolve(data);
          } catch (readError) {
            reject(new Error(`Failed to read converted file: ${readError instanceof Error ? readError.message : String(readError)}`));
          }
        }
      );
    });
  }
}
