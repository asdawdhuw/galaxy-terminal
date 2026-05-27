const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, protocol, net, shell } = require('electron')
const { join, extname, relative } = require('path')
const fs = require('fs')
const os = require('os')
const pty = require('node-pty')
const crypto = require('crypto')

process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('AttachConsole')) return
  console.error(err)
})

// Register custom protocols (bypass CSP for audio + image hotlinking)
protocol.registerSchemesAsPrivileged([
  { scheme: 'stream', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'bili-img', privileges: { standard: true, secure: true, bypassCSP: true, supportFetchAPI: true, corsEnabled: true } }
])

// --- Session Manager ---

const sessions = new Map()
let activeSessionId = null
let sessionSeq = 0

function shellPath() {
  if (os.platform() === 'win32') {
    const candidates = [
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
      'pwsh.exe'
    ]
    for (const c of candidates) {
      try {
        require('child_process').execSync(`where "${c}"`, { stdio: 'ignore' })
        return c
      } catch (_) {}
    }
    return 'powershell.exe'
  }
  return process.env.SHELL || 'bash'
}

function nextSessionName() {
  let max = 0
  for (const s of sessions.values()) {
    const m = s.name.match(/^session_(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `session_${max + 1}`
}

function createSession(cols, rows) {
  sessionSeq++
  const id = `s${sessionSeq}`
  const name = nextSessionName()
  const cwd = process.env.USERPROFILE || process.env.HOME || '.'
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    POWERSHELL_UPDATECHECK: 'Off',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
  }

  const wrapperCmd =
    'Invoke-Expression (&starship init powershell);' +
    '$o=${function:prompt};' +
    '${function:prompt}={$p=$PWD.Path;Write-Host -NoNewline "`e]777;cwd;$p`a";&$o}'

  const proc = pty.spawn(shellPath(), [
    '-NoLogo', '-NoProfile', '-NoExit', '-Command', wrapperCmd
  ], {
    name: 'xterm-256color',
    cols: cols || 120,
    rows: rows || 30,
    cwd,
    env
  })

  sessions.set(id, { id, process: proc, name, cwd, cols: cols || 120, rows: rows || 30 })
  activeSessionId = id

  proc.onData((data) => {
    // Parse CWD from custom OSC 777 sequence
    const cwdMatch = data.match(/\x1b\]777;cwd;(.+?)\x07/)
    if (cwdMatch) {
      const newCwd = cwdMatch[1]
      const s = sessions.get(id)
      if (s) s.cwd = newCwd
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:cwd', { sessionId: id, cwd: newCwd })
      }
      // Strip the OSC sequence before sending to terminal
      data = data.replace(/\x1b\]777;cwd;.+?\x07/g, '')
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:output', { sessionId: id, data })
    }
  })

  proc.onExit(({ exitCode }) => {
    // If session was already removed (intentional close via pty:close), skip
    if (!sessions.has(id)) return

    const s = sessions.get(id)
    s._exitCount = (s._exitCount || 0) + 1
    if (s._exitCount > 5) {
      // Too many consecutive crashes — give up to avoid infinite loop
      console.error(`[Session ${id}] Crashed ${s._exitCount} times, giving up`)
      sessions.delete(id)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', { id, exitCode })
      }
      if (activeSessionId === id) {
        activeSessionId = sessions.size > 0 ? [...sessions.keys()][0] : null
        if (activeSessionId && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty:switched', activeSessionId)
        }
      }
      return
    }
    // Auto-respawn after brief delay (avoid tight crash-loop)
    const ts = new Date().toISOString().slice(11, 19)
    console.log(`[${ts}] [Session ${id}] Shell exited (code ${exitCode}, crash #${s._exitCount}), respawning in 300ms...`)
    setTimeout(() => respawnSession(id), 300)
  })

  return { id, name }
}

function respawnSession(id) {
  const s = sessions.get(id)
  if (!s) return

  const cols = s.cols || 120
  const rows = s.rows || 30
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    POWERSHELL_UPDATECHECK: 'Off',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
  }

  // Remove listeners from old dead process
  try { s.process.removeAllListeners?.() } catch (_) {}
  try { s.process.kill() } catch (_) {}

  const wrapperCmd =
    'Invoke-Expression (&starship init powershell);' +
    '$o=${function:prompt};' +
    '${function:prompt}={$p=$PWD.Path;Write-Host -NoNewline "`e]777;cwd;$p`a";&$o}'

  const proc = pty.spawn(shellPath(), [
    '-NoLogo', '-NoProfile', '-NoExit', '-Command', wrapperCmd
  ], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: s.cwd,
    env
  })

  s.process = proc
  s.cols = cols
  s.rows = rows

  proc.onData((data) => {
    const cwdMatch = data.match(/\x1b\]777;cwd;(.+?)\x07/)
    if (cwdMatch) {
      const newCwd = cwdMatch[1]
      const cur = sessions.get(id)
      if (cur) cur.cwd = newCwd
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:cwd', { sessionId: id, cwd: newCwd })
      }
      data = data.replace(/\x1b\]777;cwd;.+?\x07/g, '')
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:output', { sessionId: id, data })
    }
  })

  proc.onExit(({ exitCode }) => {
    if (!sessions.has(id)) return
    const cur = sessions.get(id)
    cur._exitCount = (cur._exitCount || 0) + 1
    if (cur._exitCount > 5) {
      console.error(`[Session ${id}] Crashed ${cur._exitCount} times, giving up`)
      sessions.delete(id)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', { id, exitCode })
      }
      if (activeSessionId === id) {
        activeSessionId = sessions.size > 0 ? [...sessions.keys()][0] : null
        if (activeSessionId && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty:switched', activeSessionId)
        }
      }
      return
    }
    const ts2 = new Date().toISOString().slice(11, 19)
    console.log(`[${ts2}] [Session ${id}] Shell exited (code ${exitCode}, crash #${cur._exitCount}), respawning in 300ms...`)
    setTimeout(() => respawnSession(id), 300)
  })

  // Notify frontend to clear buffer and reset terminal for this session
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pty:respawned', { id, name: s.name })
  }
}

function killAll() {
  for (const [, s] of sessions) {
    try { s.process.kill() } catch (_) {}
  }
  sessions.clear()
  activeSessionId = null
}

// --- Menu ---

function buildMenuTemplate() {
  return [
    {
      label: 'Sessions',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:new-session')
          }
        },
        {
          label: 'Close Active Session',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:close-session')
          }
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Copy', accelerator: 'CmdOrCtrl+Shift+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+Shift+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle DevTools', accelerator: 'F12', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Audio',
      submenu: [
        {
          label: 'Toggle Music',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:toggle-music')
          }
        }
      ]
    }
  ]
}

function refreshMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()))
}

// --- Window ---

let mainWindow = null

function createWindow() {
  refreshMenu()
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 400,
    title: 'galaxy-terminal',
    backgroundColor: '#070b14',
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Backup shortcut: Ctrl+Alt+D to toggle DevTools
  globalShortcut.register('CommandOrControl+Alt+D', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../../out/renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// --- IPC ---

// Window controls (for frameless title bar)
ipcMain.on('win:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
})
ipcMain.on('win:maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  }
})
ipcMain.on('win:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
})

ipcMain.handle('shell:openExternal', async (_event, url) => {
  try { await shell.openExternal(url); return true } catch (_) { return false }
})

ipcMain.handle('search:suggest', async (_event, query) => {
  try {
    const url = 'https://suggestqueries.google.com/complete/search?client=chrome&q=' + encodeURIComponent(query)
    const res = await net.fetch(url, { headers: { 'Accept': 'application/json' } })
    const body = await res.text()
    const data = JSON.parse(body)
    return (data && data[1]) ? data[1].slice(0, 8) : []
  } catch (_) { return [] }
})

// Resolve a path — if absolute (Windows drive or /), use as-is; else relative to project root
function resolvePath(inputPath) {
  if (!inputPath || inputPath === '.') return join(__dirname, '../../..')
  if (/^[a-zA-Z]:[\\/]/.test(inputPath) || inputPath.startsWith('/')) return inputPath
  return join(__dirname, '../../..', inputPath)
}

// File reader — for FileTree double-click preview
ipcMain.handle('fs:readFile', async (_event, inputPath) => {
  const fullPath = resolvePath(inputPath)
  try {
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return { ok: false, error: 'Cannot read a directory' }
    }
    if (stat.size > 500 * 1024) {
      return { ok: false, error: 'File too large (>500KB)' }
    }
    const content = fs.readFileSync(fullPath, 'utf-8')
    const ext = extname(fullPath).slice(1) || 'txt'
    return { ok: true, content, ext, name: inputPath, size: stat.size }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Directory listing — for dynamic FileTree
ipcMain.handle('fs:listDir', async (_event, inputPath) => {
  const fullPath = resolvePath(inputPath)
  try {
    const stat = fs.statSync(fullPath)
    if (!stat.isDirectory()) {
      return { ok: false, error: 'Not a directory' }
    }
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })
    const children = entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'out' && e.name !== '$RECYCLE.BIN' && e.name !== 'System Volume Information')
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        path: `${fullPath.replace(/[\\/]+$/, '')}\\${e.name}`.replace(/\\/g, '/'),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    return { ok: true, children }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('pty:create', (_event, cols, rows) => {
  try {
    return createSession(cols, rows)
  } catch (err) {
    dialog.showErrorBox(
      'Failed to start shell',
      `Could not launch pwsh.exe.\n\n${err.message}\n\nMake sure PowerShell 7+ is installed.`
    )
    return null
  }
})

// Music library — scan project music folder
ipcMain.handle('music:list', async () => {
  const musicDir = join(__dirname, '../..', 'music')
  try {
    if (!fs.existsSync(musicDir)) return { ok: true, files: [] }
    const entries = fs.readdirSync(musicDir, { withFileTypes: true })
    const files = entries
      .filter(e => e.isFile() && /\.(mp3|wav|flac|ogg|m4a|aac|wma)$/i.test(e.name))
      .map(e => ({
        name: e.name,
        path: join(musicDir, e.name).replace(/\\/g, '/'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { ok: true, files }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Music popup window
let musicPopup = null
ipcMain.on('music:open-window', () => {
  if (musicPopup && !musicPopup.isDestroyed()) {
    musicPopup.focus()
    return
  }
  musicPopup = new BrowserWindow({
    width: 420, height: 620, minWidth: 320, minHeight: 400,
    title: 'Galaxy Music',
    backgroundColor: '#070b14',
    frame: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  })
  const baseUrl = process.env.ELECTRON_RENDERER_URL || `file://${join(__dirname, '../../out/renderer/index.html')}`
  musicPopup.loadURL(baseUrl + '#/music')
  musicPopup.on('closed', () => { musicPopup = null })
})

// Music popup — toggle always-on-top
ipcMain.handle('music:toggle-pin', () => {
  if (musicPopup && !musicPopup.isDestroyed()) {
    const pinned = !musicPopup.isAlwaysOnTop()
    musicPopup.setAlwaysOnTop(pinned)
    return { pinned }
  }
  return { pinned: false }
})

ipcMain.handle('pty:list', () => {
  return [...sessions.values()].map(s => ({ id: s.id, name: s.name }))
})

ipcMain.handle('pty:switch', (_event, id) => {
  if (sessions.has(id)) {
    activeSessionId = id
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:switched', id)
    }
    return true
  }
  return false
})

ipcMain.handle('pty:rename', (_event, id, newName) => {
  const s = sessions.get(id)
  if (s) {
    s.name = newName
    return true
  }
  return false
})

ipcMain.handle('pty:close', (_event, id) => {
  const s = sessions.get(id)
  if (!s) return false
  sessions.delete(id)
  try { s.process.removeAllListeners?.() } catch (_) {}
  try { s.process.kill() } catch (_) {}
  if (activeSessionId === id) {
    activeSessionId = sessions.size > 0 ? [...sessions.keys()][0] : null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:switched', activeSessionId)
    }
  }
  return true
})

// Per-session input buffer for command interception
const inputBufs = new Map()

ipcMain.on('pty:input', (_event, data) => {
  const s = activeSessionId && sessions.get(activeSessionId)
  if (!s) return

  // Buffer input and intercept on Enter
  if (data === '\r') {
    const buf = inputBufs.get(activeSessionId) || ''
    const cmd = buf.trim()
    inputBufs.set(activeSessionId, '')

    // Intercept known commands
    if (cmd === '/music') {
      s.process.write('\x03')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:output', { sessionId: activeSessionId, data: '\r\n\x1b[36m[Music popup opened]\x1b[0m\r\n' })
      }
      return
    }

    s.process.write(data)
  } else if (data === '\x03') {
    inputBufs.set(activeSessionId, '')
    s.process.write(data)
  } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
    inputBufs.set(activeSessionId, (inputBufs.get(activeSessionId) || '') + data)
    s.process.write(data)
  } else {
    // Arrow keys, control sequences — reset buffer
    inputBufs.set(activeSessionId, '')
    s.process.write(data)
  }
})

ipcMain.on('pty:resize', (_event, cols, rows) => {
  const s = activeSessionId && sessions.get(activeSessionId)
  if (s) s.process.resize(cols, rows)
})

// --- LRCLIB Lyrics API (free, open-source lyrics database) ---

ipcMain.handle('lyrics:search', async (_event, { artist, title }) => {
  // Clean B站 title noise: remove bracketed tags, author suffixes
  const cleanTitle = title
    .replace(/【.*?】/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[-–—].*$/, '')
    .trim() || title
  const ua = 'galaxy-terminal/0.1 (lyrics lookup)'
  const timeout = { signal: AbortSignal.timeout(8000) }
  try {
    // First try exact match
    let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(cleanTitle)}`
    let r = await fetch(url, { headers: { 'User-Agent': ua }, ...timeout })
    if (r.ok) {
      const data = await r.json()
      return {
        ok: true,
        syncedLyrics: data.syncedLyrics || null,
        plainLyrics: data.plainLyrics || null
      }
    }

    // Fallback: search by track name
    url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}`
    r = await fetch(url, { headers: { 'User-Agent': ua }, ...timeout })
    if (!r.ok) return { ok: false, error: 'No lyrics found' }
    const results = await r.json()
    if (!Array.isArray(results) || results.length === 0) return { ok: false, error: 'No lyrics found' }

    // Get full lyrics from first search result
    const id = results[0].id
    r = await fetch(`https://lrclib.net/api/get/${id}`, { headers: { 'User-Agent': ua }, ...timeout })
    if (!r.ok) return { ok: false, error: 'No lyrics found' }
    const data = await r.json()
    return {
      ok: true,
      syncedLyrics: data.syncedLyrics || null,
      plainLyrics: data.plainLyrics || null
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// --- iTunes Search API proxy (free, no auth, previewUrl built-in) ---

ipcMain.handle('itunes:search', async (_event, { term, limit = 20 }) => {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}&country=CN`
  console.log('[iTunes] Searching:', term)
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    console.log(`[iTunes] Found ${data.resultCount} results`)
    return {
      ok: true,
      results: (data.results || []).map((t) => ({
        id: t.trackId,
        name: t.trackName,
        artist: t.artistName,
        album: t.collectionName,
        artwork: t.artworkUrl100,
        previewUrl: t.previewUrl,
        duration: t.trackTimeMillis,
        price: t.trackPrice
      }))
    }
  } catch (e) {
    console.error('[iTunes] Failed:', e.message)
    return { ok: false, error: e.message }
  }
})

// --- Bilibili WBI Sign (inline — avoids bundler module loss) ---

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 52, 44, 34
]

let _wbiKey = null
let _wbiCacheTime = 0
const WBI_CACHE_TTL = 3600000

async function getMixinKey() {
  if (_wbiKey && Date.now() - _wbiCacheTime < WBI_CACHE_TTL) return _wbiKey

  const r = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { Referer: 'https://www.bilibili.com' }
  })
  const j = await r.json()
  if (!j.data?.wbi_img) throw new Error('Failed to fetch WBI keys from nav')

  const imgUrl = j.data.wbi_img.img_url
  const subUrl = j.data.wbi_img.sub_url
  const imgKey = imgUrl.split('/').pop().split('.')[0]
  const subKey = subUrl.split('/').pop().split('.')[0]
  const raw = imgKey + subKey

  _wbiKey = MIXIN_KEY_ENC_TAB.map(i => raw[i]).join('').slice(0, 32)
  _wbiCacheTime = Date.now()
  return _wbiKey
}

function signParams(params, mixinKey) {
  const sorted = Object.keys(params).sort()
  const query = sorted
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
  const wts = Math.floor(Date.now() / 1000)
  const w_rid = crypto.createHash('md5').update(query + mixinKey).digest('hex')
  return { ...params, wts, w_rid }
}

// --- Bilibili Search (stable v2 endpoint, 20 results, no WBI needed) ---

ipcMain.handle('bilibili:search', async (_event, { keyword }) => {
  const url = `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(keyword)}&search_type=video`
  console.log('[Bilibili] Searching:', keyword)
  try {
    const r = await fetch(url, {
      headers: { Referer: 'https://www.bilibili.com' },
      signal: AbortSignal.timeout(8000)
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (data.code !== 0) throw new Error(`B站 code=${data.code}: ${data.message}`)

    const videoResult = (data.data?.result || []).find((g) => g.result_type === 'video')
    const items = (videoResult?.data || []).map((v) => ({
      bvid: v.bvid,
      aid: v.aid,
      title: v.title?.replace(/<[^>]+>/g, ''),
      artist: v.author,
      cover: v.pic,
      duration: v.duration,
      playCount: v.play
    }))

    console.log(`[Bilibili] Found ${items.length} results`)
    return { ok: true, results: items }
  } catch (e) {
    console.error('[Bilibili] Search failed:', e.message)
    return { ok: false, error: e.message }
  }
})

// --- Bilibili Play URL (WBI-signed, fetches cid then audio stream) ---

ipcMain.handle('bilibili:playurl', async (_event, { bvid }) => {
  console.log('[Bilibili] Getting playurl for:', bvid)
  try {
    // Step 1: get cid from pagelist
    const plUrl = `https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`
    const plR = await fetch(plUrl, {
      headers: { Referer: 'https://www.bilibili.com' },
      signal: AbortSignal.timeout(6000)
    })
    const plData = await plR.json()
    if (plData.code !== 0 || !plData.data?.[0]?.cid) {
      throw new Error(`pagelist failed: code=${plData.code}`)
    }
    const cid = plData.data[0].cid
    console.log(`[Bilibili] Got cid=${cid} for ${bvid}`)

    // Step 2: WBI-sign the playurl request
    const mixinKey = await getMixinKey()
    const params = signParams({ bvid, cid, fnval: '4048', fnver: '0', fourk: '1', qn: '0' }, mixinKey)
    const paramsStr = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&')

    const puUrl = `https://api.bilibili.com/x/player/wbi/playurl?${paramsStr}`
    console.log('[Bilibili] Fetching playurl with WBI signature...')
    const puR = await fetch(puUrl, {
      headers: { Referer: 'https://www.bilibili.com' },
      signal: AbortSignal.timeout(8000)
    })
    const puData = await puR.json()
    if (puData.code !== 0) {
      throw new Error(`playurl failed: code=${puData.code} ${puData.message || ''}`)
    }

    const audio = puData.data?.dash?.audio?.[0]
    if (!audio?.baseUrl) {
      throw new Error('No audio stream found (dash.audio empty)')
    }

    console.log(`[Bilibili] Audio URL: ${audio.baseUrl.slice(0, 80)}...`)
    return {
      ok: true,
      url: audio.baseUrl,
      backupUrl: audio.backupUrl?.[0] || null,
      bandwidth: audio.bandwidth,
      duration: puData.data.timelength
    }
  } catch (e) {
    console.error('[Bilibili] Playurl failed:', e.message)
    return { ok: false, error: e.message }
  }
})

// --- App lifecycle ---

app.whenReady().then(() => {
  // Custom stream:// protocol — proxies remote audio + local music files
  protocol.handle('stream', async (request) => {
    try {
      const targetUrl = new URL(request.url).searchParams.get('url')
      if (!targetUrl) return new Response('Missing url param', { status: 400 })

      // Local file: serve with proper streaming + range support for audio seek
      if (/^[a-zA-Z]:[\\/]/.test(targetUrl) || targetUrl.startsWith('/')) {
        const fs = require('fs')
        const path = require('path')
        const mimeTypes = {
          '.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.wma':'audio/x-ms-wma',
          '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.bmp':'image/bmp','.ico':'image/x-icon',
          '.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.mov':'video/quicktime','.wmv':'video/x-ms-wmv','.flv':'video/x-flv'
        }
        const ext = path.extname(targetUrl).toLowerCase()
        const mime = mimeTypes[ext] || 'audio/mpeg'

        if (!fs.existsSync(targetUrl)) return new Response('Not found', { status: 404 })
        const stat = fs.statSync(targetUrl)
        const fileSize = stat.size

        // Handle Range requests (needed for audio seeking)
        const rangeHeader = request.headers.get('range')
        if (rangeHeader) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-')
          const start = parseInt(parts[0], 10)
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
          const chunkSize = (end - start) + 1
          const buf = Buffer.alloc(chunkSize)
          const fd = fs.openSync(targetUrl, 'r')
          fs.readSync(fd, buf, 0, chunkSize, start)
          fs.closeSync(fd)
          return new Response(buf, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Content-Length': String(chunkSize),
              'Accept-Ranges': 'bytes',
            }
          })
        }

        // Full file response (initial load)
        const data = fs.readFileSync(targetUrl)
        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes',
          }
        })
      }

      // Remote URL — proxy with B站 Referer
      console.log('[stream] Proxying:', targetUrl.slice(0, 80) + '...')
      return net.fetch(targetUrl, {
        headers: { Referer: 'https://www.bilibili.com' }
      })
    } catch (e) {
      console.error('[stream] Error:', e.message)
      return new Response('Audio fetch failed', { status: 500 })
    }
  })

  // Custom bili-img:// protocol — proxies B站 images with Referer to bypass hotlink protection
  protocol.handle('bili-img', async (request) => {
    try {
      let rawUrl = request.url.replace(/^bili-img:\/\//, '')
      // Handle bili-img://https/xxx edge case (double scheme)
      if (rawUrl.startsWith('https/')) rawUrl = rawUrl.replace('https/', 'https://')
      else if (rawUrl.startsWith('http/')) rawUrl = rawUrl.replace('http/', 'http://')
      else if (!rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl

      console.log('[bili-img] Proxying:', rawUrl.slice(0, 80) + '...')

      const res = await fetch(rawUrl, {
        headers: {
          Referer: 'https://www.bilibili.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      if (!res.ok) {
        console.error('[bili-img] HTTP', res.status)
        return new Response(null, { status: res.status })
      }

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/jpeg' }
      })
    } catch (e) {
      console.error('[bili-img] Error:', e.message)
      return new Response(null, { status: 500 })
    }
  })
  createWindow()
})

app.on('window-all-closed', () => {
  killAll()
  app.quit()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  killAll()
})
