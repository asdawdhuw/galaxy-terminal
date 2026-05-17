const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join } = require('path')
const os = require('os')
const pty = require('node-pty')

process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('AttachConsole')) return
  console.error(err)
})

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

  const name = `pwsh-${sessionSeq}`
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

const menuTemplate = [
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
  }
]

// --- Window ---

let mainWindow = null

function createWindow() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
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

// --- App lifecycle ---

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  killAll()
  app.quit()
})

app.on('before-quit', () => {
  killAll()
})
