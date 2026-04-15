# OpenCAD — Claude Code Instructions

## Project

OpenCAD is a VS Code extension that views IFC (Industry Foundation Classes) CAD files with interactive 3D visualization. It targets IFC 4x3 (ISO 16739-1:2024) as the primary standard.

## Critical Rules

1. **Bun only** — This project exclusively uses Bun as the package manager and script runner. Never use npm, yarn, pnpm, or npx. Use `bun install`, `bun run <script>`, `bun x <package>`.
2. **No `any`** — TypeScript strict mode is enabled. Avoid `any`; use proper types or `unknown` with type guards.
3. **Two contexts** — Extension host (Node.js) and webview (browser) are separate. They communicate only via `postMessage`. Never import `vscode` in webview code. Never import `three` in extension host code.
4. **CSP required** — All webview HTML must include Content-Security-Policy with nonces. Use `webview.cspSource` for allowed origins.
5. **Conventional Commits** — All commit messages follow the format: `type(scope): description`.

## Architecture

```
src/
├── extension.ts            ← VS Code extension entry (Node.js)
├── ifcEditorProvider.ts    ← Custom editor: reads .ifc, creates webview
└── webview/
    ├── main.ts             ← Webview entry: receives file data, manages viewer
    ├── viewer.ts           ← Three.js scene, IFC loading via web-ifc
    └── toolbar.ts          ← UI button handlers
```

### Data Flow

```
User opens .ifc file
  → VS Code calls IFCEditorProvider.resolveCustomEditor()
  → Extension reads file bytes via vscode.workspace.fs.readFile()
  → Extension sends bytes to webview via postMessage({ type: "loadFile", data })
  → Webview receives data, creates Blob URL
  → IFCLoader (web-ifc WASM) parses the blob
  → Three.js renders the model in the viewport
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript 5+ (strict) |
| Bundler | Webpack 5 (dual config) |
| 3D | Three.js |
| IFC Parser | web-ifc (WASM) + web-ifc-three |
| Lint | ESLint + @typescript-eslint |
| CI | GitHub Actions + oven-sh/setup-bun |

## Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install all dependencies |
| `bun run build` | Production webpack build |
| `bun run watch` | Development build with file watching |
| `bun run dev` | One-time development build |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run package` | Package as .vsix |

## Style

- Prefer `const`; use `let` only when reassignment is needed
- No default exports — use named exports
- Functions should do one thing
- Error messages should be user-friendly (shown via `vscode.window.showErrorMessage`)
- Use `vscode.Uri` for all file path operations in the extension host
- Resource URIs in webview must go through `webview.asWebviewUri()`

## Testing

Press `F5` in VS Code to launch Extension Development Host with the extension loaded. Open any `.ifc` file to test.

## Security

- Webview content is sandboxed; CSP prevents inline scripts (except via nonce)
- File data is transferred as `Uint8Array` — no eval or dynamic code execution
- WASM is loaded from the extension's own dist folder, not from CDN
- No network requests are made; everything is local
