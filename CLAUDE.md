# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

**galaxy-terminal** — A cosmic-themed desktop terminal for Windows. Phase 1 goal: Electron shell + real PowerShell (pwsh.exe) integration via PTY, rendered with Xterm.js inside Warp-style command blocks.

## Key Commands

```bash
npm install          # Install all dependencies (including electron-rebuild for node-pty)
npm run dev          # Start electron-vite dev server with HMR
npm run build        # Production build
npm run preview      # Preview production build
```

## Tech Stack & Architecture

- **Desktop shell**: Electron (not Tauri). Chosen for `node-pty` maturity on Windows.
- **Build tooling**: `electron-vite` — handles main/preload/renderer HMR separation, native module rebuild.
- **Frontend**: React 18 + Tailwind CSS 3 + Xterm.js 5.
- **PTY bridge**: `node-pty` spawns `pwsh.exe` (PowerShell 7+) — NOT `powershell.exe`.
- **Window**: Standard bordered window for Phase 1; frameless/transparent deferred.

## Data Flow (the one pipeline that matters)

```
User keystroke → Xterm.js onData → IPC (pty:input) → node-pty.write → pwsh.exe
pwsh.exe stdout → node-pty onData → IPC (pty:output) → Xterm.js write → DOM
```

There are exactly 4 IPC channels: `pty:create`, `pty:input`, `pty:output`, `pty:resize`.

## Single Xterm.js, Visual Block Splitting

One global Xterm.js instance backed by one pwsh.exe PTY session. PowerShell state (CWD, env vars) is continuous. Blocks are a **visual overlay**: when the user presses Enter, the current input line text is snapshot into a read-only `CommandBlock` card above. Output text between Enters belongs to that block. True Warp-style semantic block splitting is deferred to Phase 2.

## Xterm.js Addons (Phase 1)

- `@xterm/addon-fit` — auto-resize to container
- `@xterm/addon-web-links` — clickable URLs in output
- `@xterm/addon-search` — Ctrl+F text search

## Galaxy Background

Static dark-space image (`src/assets/galaxy-bg.jpg`) for Phase 1. Canvas particle system deferred to Phase 2. A semi-transparent dark overlay (`bg-black/40` or `backdrop-blur`) sits between the background and terminal text for readability.

## Directory Structure

```
galaxy-terminal/
├── electron/
│   ├── main/
│   │   ├── index.js          # Electron main process, BrowserWindow creation
│   │   └── pty-manager.js    # pwsh.exe spawn, IPC handlers
│   └── preload/
│       └── index.js          # contextBridge exposing IPC API
├── src/
│   ├── index.html
│   ├── main.jsx              # React entry
│   ├── App.jsx               # Root layout
│   ├── App.css               # Tailwind directives + global styles
│   ├── components/
│   │   ├── TerminalCanvas.jsx   # Xterm.js mount + onData/onRender
│   │   ├── BlockList.jsx        # Scrollable list of CommandBlocks
│   │   ├── CommandBlock.jsx     # Read-only snapshot of one command + output
│   │   ├── InputLine.jsx        # Active input row (prompt + cursor)
│   │   └── GalaxyBackground.jsx # Background image + dark overlay
│   └── assets/
│       └── galaxy-bg.jpg
├── package.json
├── electron.vite.config.mjs
├── tailwind.config.js
└── postcss.config.js
```
