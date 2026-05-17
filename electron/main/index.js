const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, protocol, net } = require('electron')
const { join } = require('path')
const os = require('os')
const pty = require('node-pty')

process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('AttachConsole')) return
  console.error(err)
})

// Register custom stream:// protocol (bypasses CSP for audio playback)
protocol.registerSchemesAsPrivileged([
  { scheme: 'stream', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
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

function createSession(cols, rows) {
  const id = `s${++sessionSeq}`
  const cwd = process.env.USERPROFILE || process.env.HOME || '.'
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    POWERSHELL_UPDATECHECK: 'Off',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
  }

  const proc = pty.spawn(shellPath(), [
    '-NoLogo', '-NoProfile', '-NoExit', '-Command',
    'Invoke-Expression (&starship init powershell)'
  ], {
    name: 'xterm-256color',
    cols: cols || 120,
    rows: rows || 30,
    cwd,
    env
  })

  const name = `session_${sessionSeq}`
  sessions.set(id, { id, process: proc, name, cwd })
  activeSessionId = id

  proc.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:output', { sessionId: id, data })
    }
  })

  proc.onExit(({ exitCode }) => {
    if (sessions.has(id)) {
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
    }
  })

  return { id, name }
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
    backgroundColor: '#06060f',
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
    // ██████████ FORCE DevTools open — always visible on startup ██████████
    mainWindow.webContents.openDevTools({ mode: 'detach' })
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
  try { s.process.kill() } catch (_) {}
  sessions.delete(id)
  if (activeSessionId === id) {
    activeSessionId = sessions.size > 0 ? [...sessions.keys()][0] : null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:switched', activeSessionId)
    }
  }
  return true
})

ipcMain.on('pty:input', (_event, data) => {
  const s = activeSessionId && sessions.get(activeSessionId)
  if (s) s.process.write(data)
})

ipcMain.on('pty:resize', (_event, cols, rows) => {
  const s = activeSessionId && sessions.get(activeSessionId)
  if (s) s.process.resize(cols, rows)
})

// --- Spotify OAuth (main-process token exchange — bypasses CSP) ---

ipcMain.handle('spotify:auth', async (_event, { authUrl, clientId, redirectUri, codeVerifier }) => {
  // Step 1 — open auth window & capture code
  const code = await new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      title: 'Spotify Login',
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })

    let done = false

    function intercept(url) {
      if (done) return
      try {
        const c = new URL(url).searchParams.get('code')
        if (c) {
          done = true
          console.log('██████████ [Main] Code captured:', c.slice(0, 20) + '...')
          // Delay close so the redirect page fully loads (avoids race)
          setTimeout(() => { if (!authWindow.isDestroyed()) authWindow.close() }, 100)
          resolve(c)
        }
      } catch (_) {}
    }

    authWindow.webContents.on('will-navigate', (_e, url) => intercept(url))
    authWindow.webContents.on('will-redirect', (_e, url) => intercept(url))
    authWindow.on('closed', () => { if (!done) { done = true; resolve(null) } })
    authWindow.loadURL(authUrl)
  })

  if (!code) {
    console.log('██████████ [Main] No code — user cancelled')
    return { error: 'authorization_cancelled' }
  }

  // Step 2 — exchange code for token IN MAIN PROCESS (no CSP!)
  console.log('██████████ [Main] Exchanging code for token...')
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier || ''
    })
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const j = await r.json()
    if (j.access_token) {
      console.log('██████████ [Main] Token exchange SUCCESS ✅')
      // Push to renderer via event channel as well
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('spotify-token-success', {
          access_token: j.access_token,
          refresh_token: j.refresh_token
        })
      }
      return {
        access_token: j.access_token,
        refresh_token: j.refresh_token || null
      }
    } else {
      console.error('██████████ [Main] Token exchange FAILED ❌', j)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('spotify-token-error', j.error_description || j.error || 'unknown')
      }
      return { error: j.error_description || j.error || 'token_exchange_failed' }
    }
  } catch (e) {
    console.error('██████████ [Main] Token network error ❌', e.message)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('spotify-token-error', e.message)
    }
    return { error: e.message }
  }
})

// Spotify token refresh (also via main process to bypass CSP)
ipcMain.handle('spotify:refresh', async (_event, { refreshToken, clientId }) => {
  console.log('██████████ [Main] Refreshing token...')
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId
    })
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const j = await r.json()
    if (j.access_token) {
      console.log('██████████ [Main] Refresh SUCCESS ✅')
      return { access_token: j.access_token, refresh_token: j.refresh_token || null }
    }
    console.log('██████████ [Main] Refresh FAILED ❌', j)
    return { error: j.error_description || j.error || 'refresh_failed' }
  } catch (e) {
    return { error: e.message }
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

// --- App lifecycle ---

app.whenReady().then(() => {
  // Custom stream:// protocol — must be registered AFTER app is ready
  protocol.handle('stream', async (request) => {
    try {
      const targetUrl = new URL(request.url).searchParams.get('url')
      if (!targetUrl) return new Response('Missing url param', { status: 400 })
      console.log('[stream] Proxying:', targetUrl.slice(0, 80) + '...')
      return net.fetch(targetUrl)
    } catch (e) {
      console.error('[stream] Error:', e.message)
      return new Response('Audio fetch failed', { status: 500 })
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
