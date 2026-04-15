# Contributing to OpenCAD

Thank you for your interest in contributing to OpenCAD! This guide will help you get started.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/opencad/opencad-vscode/issues)
2. If not, create a new issue using the **Bug Report** template
3. Include:
   - VS Code version
   - OpenCAD version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Sample IFC file (if possible)

### Suggesting Features

1. Check existing [Issues](https://github.com/opencad/opencad-vscode/issues) for similar suggestions
2. Create a new issue using the **Feature Request** template
3. Describe the use case and expected behavior

### Submitting Code

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/opencad-vscode.git
   cd opencad-vscode
   ```
3. **Create a feature branch** from `develop`:
   ```bash
   git checkout -b feature/your-feature develop
   ```
4. **Install dependencies:**
   ```bash
   bun install
   ```
5. **Make your changes** and ensure:
   - Code compiles: `bun run build`
   - Linting passes: `bun run lint`
   - The extension works in the Extension Development Host (`F5`)
6. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add element selection on click"
   ```
7. **Push** to your fork and create a **Pull Request** against `develop`

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Description |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation change |
| `style:` | Code style (formatting, semicolons, etc.) |
| `refactor:` | Code refactoring |
| `perf:` | Performance improvement |
| `test:` | Adding or updating tests |
| `build:` | Build system or dependencies |
| `ci:` | CI/CD configuration |
| `chore:` | Other changes |

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- VS Code >= 1.85.0

### Building

```bash
bun install
bun run build
```

### Development Mode

```bash
bun run watch
```

Then press `F5` in VS Code to launch the Extension Development Host.

### Project Structure

```
src/
├── extension.ts          # Extension activation, command registration
├── ifcEditorProvider.ts   # Custom editor provider (IFC → webview)
└── webview/
    ├── main.ts            # Webview entry, message handling
    ├── viewer.ts          # Three.js scene, IFC loading, camera
    └── toolbar.ts         # UI toolbar event handlers
```

### Key Concepts

- **Custom Editor Provider**: VS Code API for rendering custom file types
- **Webview**: Sandboxed HTML/JS context for the 3D viewer
- **Message Passing**: Extension ↔ Webview communication via `postMessage`

## Style Guide

- TypeScript strict mode
- ESLint for code quality
- Use meaningful variable and function names
- Keep functions focused and small
- Add JSDoc comments for public APIs

## Questions?

Open a [Discussion](https://github.com/opencad/opencad-vscode/discussions) or reach out in Issues.

---

Thank you for helping make OpenCAD better! 🏗️
