<p align="center">
  <img src="introduce.png" alt="Galaxy Terminal" width="600">
</p>

<h1 align="center">Galaxy Terminal</h1>

<p align="center">
  <strong>🌌 A Cosmic-Themed Desktop Terminal for Windows</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/electron-33.x-brightgreen?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/react-18.x-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/version-0.1.0-orange?style=flat-square" alt="Version">
</p>

---

## ✨ Features

- **Real PowerShell PTY** — Full `pwsh.exe` integration via `node-pty`. Not a mock terminal.
- **Cosmic Visuals** — Galaxy starfield background, nebula overlays, scan lines, multi-theme support.
- **Multi-Session Tabs** — Create, switch, rename, and close independent PTY sessions.
- **Command Blocks** — Warp-style visual command/output separation.
- **Galaxy Spotlight** — `Ctrl+K` command palette with `/help`, `/galaxy`, `/canvas`, `/memo` and more.
- **Aether Mind Map** — Visual memo/knowledge graph with orbital planet nodes.
- **Music Search** —  music search & playback from Bilibili, with mini-player.
- **3-Tier Ambient Audio** — Dynamic idle/active/climax background music that responds to typing.
- **Local Music Player** — Play local MP3 files with spectrum visualizer.
- **File Tree Explorer** — Browse directories, double-click to open files.
- **Void Dasher** — Retro arcade mini-game built in.
- **Custom Themes** — Orion, Nebula, and more — switch on the fly.

---

## 🖥️ Screenshots

<p align="center">
  <strong>4 Cosmic Themes</strong>
</p>

<table align="center">
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/asdawdhuw/galaxy-terminal/main/screenshots/black.png?v=2" width="400"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/asdawdhuw/galaxy-terminal/main/screenshots/Snipaste_2026-06-05_18-45-39.png" width="400"></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/asdawdhuw/galaxy-terminal/main/screenshots/grown.png" width="400"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/asdawdhuw/galaxy-terminal/main/screenshots/Snipaste_2026-06-05_18-46-15.png" width="400"></td>
  </tr>
</table>

---

## 📦 Download

Download the latest installer from [Releases](https://github.com/asdawdhuw/galaxy-terminal/releases):

- **Galaxy Terminal Setup x.x.x.exe** — NSIS installer, supports custom install path

Or use the portable version from `win-unpacked/` in the release assets.

> **System Requirements**: Windows 10/11 x64. PowerShell 7+ recommended.

---

## 🚀 Quick Start (Development)

```bash
# Clone
git clone https://github.com/asdawdhuw/galaxy-terminal.git
cd galaxy-terminal

# Install dependencies
npm install

# Start dev server (with HMR)
npm run dev

# Build production package
npm run dist
```

---

## 🎮 Built-in Commands

Type these directly in the terminal:

| Command | Action |
|---------|--------|
| `/help` or `/galaxy` | Show available commands |
| `/theme` | Open theme picker |
| `/canvas` | Toggle Multiverse canvas view |
| `/memo` | Toggle Aether mind map |
| `/music` | Open music player |
| `/games` | Launch Void Dasher |
| `/chill` | Toggle chill mode |
| `/focus` | Toggle focus mode |
| `/web` | Open web URL bar |
| `ctrl+S` | Galaxy Spotlight |
| `ctrl+wheel` | Zoom front size |
| `ctrl+F` | Text search |


---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33 |
| Build | electron-vite |
| UI | React 18 + Tailwind CSS 3 |
| Terminal | Xterm.js 6 + node-pty |
| Graphics | Canvas API + Framer Motion |
| Audio | Web Audio API + Stream Protocol |
| Package | electron-builder (NSIS) |

---

## 📁 Project Structure

```
galaxy-terminal/
├── electron/
│   ├── main/index.js          # Main process, PTY, IPC, protocols
│   └── preload/index.js       # Context bridge API
├── src/
│   ├── App.jsx                # Root layout & state
│   ├── components/            # React components
│   │   ├── TerminalCanvas.jsx # Xterm.js mount
│   │   ├── TopMenuBar.jsx     # Menu bar + audio panel
│   │   ├── AetherMap.jsx      # Mind map canvas
│   │   ├── RightMusicSidebar.jsx
│   │   ├── MultiverseView.jsx # Terminal session canvas
│   │   ├── VoidDasher.jsx     # Arcade game
│   │   └── ...
│   ├── hooks/                 # Audio engine, music controller
│   └── assets/                # Images & static resources
├── sound/                     # Default ambient audio files
└── package.json
```

---

## 📄 License

MIT © [asdawdhuw](https://github.com/asdawdhuw)

---

<p align="center">
  <sub>Built with ❤️ and a lot of ☕</sub>
</p>
