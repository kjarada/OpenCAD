# OpenCAD — Copilot Instructions

## Project Overview

OpenCAD is a VS Code extension for viewing CAD files (starting with IFC 4x3). It renders 3D models in a webview using Three.js and web-ifc (WASM-based IFC parser).

## Tech Stack

- **Runtime / Package Manager**: Bun (exclusively — never use npm, yarn, or pnpm)
- **Language**: TypeScript (strict mode)
- **Bundler**: Webpack (dual config — Node extension + web webview)
- **3D Engine**: Three.js
- **IFC Parser**: web-ifc + web-ifc-three (WASM)
- **Linting**: ESLint with @typescript-eslint
- **CI/CD**: GitHub Actions with `oven-sh/setup-bun`

## Architecture

The extension has two isolated execution contexts:

1. **Extension Host** (Node.js context) — `src/extension.ts`, `src/ifcEditorProvider.ts`
   - Registers the custom editor provider for `.ifc` files
   - Reads file data from disk and passes it to the webview via `postMessage`
   - Handles VS Code commands

2. **Webview** (browser context) — `src/webview/`
   - Receives IFC file bytes from the extension host
   - Uses web-ifc (WASM) to parse IFC data
   - Renders 3D scene with Three.js
   - Cannot access Node.js or VS Code APIs directly

Communication between the two is exclusively via `postMessage` / `onDidReceiveMessage`.

## Code Conventions

- Use **Bun** for all package management and script execution (`bun install`, `bun run build`, `bun x`)
- Never introduce npm, yarn, or pnpm commands or lockfiles
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
| `src/webview/main.ts` | Webview entry point, message handling |
| `src/webview/viewer.ts` | Three.js scene, IFC loading, camera controls |
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

## Important Constraints

- The webview runs in a sandboxed iframe — no Node.js APIs
- WASM files (web-ifc) must be copied to `dist/webview/` via CopyWebpackPlugin
- `retainContextWhenHidden: true` is set to keep 3D state when the tab is hidden
- The extension uses `CustomReadonlyEditorProvider` (read-only — no save/edit)
- Three.js imports in the webview must use the `/examples/jsm/` path for tree-shaking
