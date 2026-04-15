# OpenCAD — Copilot Instructions

## Project Overview

OpenCAD is a VS Code extension for viewing CAD files (starting with IFC 4x3). It uses IfcOpenShell's IfcConvert (C++ binary) to convert IFC to GLB, then renders the 3D model in a webview using Three.js.

## Tech Stack

- **Runtime / Package Manager**: Bun (exclusively — the ONLY package manager and script runner for this project)
- **Language**: TypeScript (strict mode)
- **Bundler**: Webpack (dual config — Node extension + web webview)
- **3D Engine**: Three.js (GLTFLoader for rendering)
- **IFC Engine**: IfcOpenShell IfcConvert (native C++ binary, IFC → GLB conversion)
- **Linting**: ESLint with @typescript-eslint
- **CI/CD**: GitHub Actions with `oven-sh/setup-bun`

## Architecture

The extension has two isolated execution contexts:

1. **Extension Host** (Node.js context) — `src/extension.ts`, `src/ifcEditorProvider.ts`, `src/ifcConvertManager.ts`
   - Registers the custom editor provider for `.ifc` files
   - Downloads IfcConvert binary on first use (cached in global storage)
   - Converts IFC → GLB via IfcConvert subprocess
   - Sends GLB bytes to the webview via `postMessage`
   - Handles VS Code commands

2. **Webview** (browser context) — `src/webview/`
   - Receives GLB bytes from the extension host
   - Renders 3D scene with Three.js GLTFLoader
   - Cannot access Node.js or VS Code APIs directly

Communication between the two is exclusively via `postMessage` / `onDidReceiveMessage`.

## Code Conventions

- Use **Bun** exclusively for all package management and script execution (`bun install`, `bun run build`, `bun x`)
- This project has NO npm/yarn/pnpm — only Bun. All scripts, CI/CD, tasks, and docs must reference Bun commands
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `build:`, `ci:`
- TypeScript strict mode — no `any` unless absolutely necessary
- Prefer `const` over `let`; never use `var`
- Use meaningful names; no single-letter variables outside loops
- Keep functions small and focused
- Use VS Code's `webview.cspSource` and nonces for Content Security Policy
- All webview HTML must include a strict CSP meta tag
- File paths in the extension host should use `vscode.Uri` APIs, not raw string paths

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Extension activation, command registration |
| `src/ifcEditorProvider.ts` | CustomReadonlyEditorProvider for IFC files |
| `src/ifcConvertManager.ts` | Downloads & runs IfcConvert binary |
| `src/webview/main.ts` | Webview entry point, message handling |
| `src/webview/viewer.ts` | Three.js scene, GLB loading, camera controls |
| `src/webview/toolbar.ts` | Toolbar button event handlers |
| `webpack.config.js` | Dual webpack config (extension + webview) |

## Build Commands

```bash
bun install              # Install dependencies
bun run build            # Production build
bun run watch            # Dev build with watch
bun run lint             # Run ESLint
bun run package          # Create .vsix package
```

## Bun — Package Manager & Script Runner

This project **exclusively** uses [Bun](https://bun.sh) as its package manager and script runner.

- **Never** use `npm`, `npx`, `yarn`, or `pnpm` in any context — code, scripts, CI/CD, tasks, docs, or terminal commands
- VS Code tasks (`.vscode/tasks.json`) must use `"type": "shell"` with `bun run <script>` — never `"type": "npm"`
- The lockfile is `bun.lock` — never commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`
- CI/CD workflows use `oven-sh/setup-bun` — never `actions/setup-node` for running scripts
- Use `bun x <package>` instead of `npx <package>`
- Use `bun install` instead of `npm install`

## Important Constraints

- The webview runs in a sandboxed iframe — no Node.js APIs
- IfcConvert binary is auto-downloaded on first use and cached in `context.globalStorageUri`
- `retainContextWhenHidden: true` is set to keep 3D state when the tab is hidden
- The extension uses `CustomReadonlyEditorProvider` (read-only — no save/edit)
- Three.js imports in the webview must use the `/examples/jsm/` path for tree-shaking
- The extension requires internet access on first use to download IfcConvert (~20 MB)
