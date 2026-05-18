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

## Data Flow

### Terminal pipeline
```
User keystroke → Xterm.js onData → IPC (pty:input) → node-pty.write → pwsh.exe
pwsh.exe stdout → node-pty onData → IPC (pty:output) → Xterm.js write → DOM
```

PTY IPC channels: `pty:create`, `pty:input`, `pty:output`, `pty:resize`, `pty:list`, `pty:switch`, `pty:rename`, `pty:close`.

### Music pipeline (Bilibili primary, iTunes fallback)

```
User types in RightMusicSidebar
  → bilibili:search IPC → fetch B站 search/all/v2 (no WBI needed)
  → returns [{ bvid, title, artist, cover, duration }]

User double-clicks a track
  → bilibili:playurl IPC
    1. fetch pagelist?bvid= → get cid
    2. getMixinKey() → fetch /x/web-interface/nav → extract img_key+sub_key → apply MIXIN_KEY_ENC_TAB → 32-char mixin key
    3. signParams({bvid,cid,fnval:4048,...}, mixinKey) → sort params → md5(params+mixinKey) → w_rid + wts
    4. fetch /x/player/wbi/playurl?...&w_rid=...&wts=... → dash.audio[0].baseUrl
  → returns { url, backupUrl }

Renderer plays via: Audio.src = `stream://audio?url=${encodeURIComponent(audioUrl)}`
  → Electron protocol.handle('stream') → net.fetch(url, { headers: { Referer: 'https://www.bilibili.com' } })
```

**WBI signing is fully inlined in `electron/main/index.js`** (not an external module — avoids bundler module loss). Uses only Node.js built-in `crypto` for md5. Mixin key cached for 1 hour.

## Single Xterm.js, Visual Block Splitting

One global Xterm.js instance backed by one pwsh.exe PTY session. PowerShell state (CWD, env vars) is continuous. Blocks are a **visual overlay**: when the user presses Enter, the current input line text is snapshot into a read-only `CommandBlock` card above. Output text between Enters belongs to that block. True Warp-style semantic block splitting is deferred to Phase 2.

## Xterm.js Addons (Phase 1)

- `@xterm/addon-fit` — auto-resize to container
- `@xterm/addon-web-links` — clickable URLs in output
- `@xterm/addon-search` — Ctrl+F text search

## Galaxy Background

Static dark-space image (`src/assets/Snipaste_2026-05-17_11-45-36.png`), Starfield canvas particles, optional scan line (`showScanLine` state), and nebula overlay CSS gradients. A semi-transparent dark overlay sits between the background and terminal text for readability.

## Key Conventions & Gotchas

- **All external API calls MUST go through the main process** (IPC handlers), never from the renderer directly. This bypasses CSP restrictions.
- **`stream://` protocol** proxies arbitrary audio URLs with `Referer: https://www.bilibili.com` header. Essential for B站 audio to work.
- **Track identity** uses `bvid` field (B站 video ID), NOT `id`. RightMusicSidebar compares `currentTrack?.bvid === track.bvid`.
- **TopMenuBar** uses `musicTrack.title || musicTrack.name` for cross-provider compatibility.
- **Never split main-process code into external files** unless the bundler is configured to include them. Prefer inline functions in `electron/main/index.js`.
- **Multi-session PTY**: sessions stored in a Map, each with independent buffer. `switchDisplay()` in TerminalCanvas resets xterm and replays the target session's buffer.
- **Ctrl+Wheel** zooms font size (10-28px). PTY resize is intentionally SKIPPED during zoom to prevent pwsh re-render duplication.

## Directory Structure

```
galaxy-terminal/
├── electron/
│   ├── main/
│   │   └── index.js          # Electron main process: BrowserWindow, PTY sessions, ALL IPC handlers (Spotify OAuth, iTunes search, Bilibili WBI search+playurl, stream:// protocol)
│   └── preload/
│       └── index.js          # contextBridge exposing IPC API (terminal, spotify, itunes, bilibili methods)
├── src/
│   ├── index.html
│   ├── main.jsx              # React entry
│   ├── App.jsx               # Root layout: SplashScreen → GalaxyBackground → TopMenuBar → SessionList + TerminalCanvas + RightMusicSidebar → status bar
│   ├── App.css               # Tailwind directives + global styles + splash screen keyframes + search bar + xterm overrides
│   ├── components/
│   │   ├── TerminalCanvas.jsx   # Xterm.js mount + onData/onRender + search bar + font zoom toast + IKD audio engine
│   │   ├── BlockList.jsx        # Scrollable list of CommandBlocks (Warp-style visual blocks)
│   │   ├── CommandBlock.jsx     # Read-only snapshot of one command + ANSI-to-HTML output
│   │   ├── SessionList.jsx      # Left sidebar: PTY session tabs (switch/rename/close/new)
│   │   ├── SessionItem.jsx      # Single session tab row
│   │   ├── TopMenuBar.jsx       # Top bar: music toggle, clock, volume, Audio panel (3-tier ambient tracks)
│   │   ├── RightMusicSidebar.jsx # Right sidebar: Bilibili music search + play + auto-radio
│   │   ├── InputBar.jsx         # Bottom input line (search-style command input)
│   │   ├── SearchBar.jsx        # Xterm.js text search overlay (Ctrl+F)
│   │   ├── SplashScreen.jsx     # Deep-space animated splash with galaxy core, nebula, starfield
│   │   ├── GalaxyBackground.jsx # Background image + Starfield + scan line + nebula overlay
│   │   └── Starfield.jsx        # Canvas twinkling star particles
│   ├── hooks/
│   │   ├── useNeteaseMusicController.js  # Bilibili music: search → bilibili:search IPC, play → bilibili:playurl IPC → stream://, auto-radio next track
│   │   ├── useSpotifyController.js       # Spotify OAuth PKCE (main process token exchange), search, play via Web API
│   │   └── useAudioEngine.js             # 3-tier IKD ambient audio: idle/active/climax crossfade based on typing WPM
│   └── assets/
│       └── galaxy-bg.jpg (replaced by Snipaste_*.png)
├── sound/                    # Ambient MP3 files for 3-tier audio engine
├── package.json
├── electron.vite.config.mjs
├── tailwind.config.js
└── postcss.config.js
```
