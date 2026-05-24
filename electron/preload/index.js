const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('win', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close')
})

contextBridge.exposeInMainWorld('terminal', {
  createPty: (cols, rows) => ipcRenderer.invoke('pty:create', cols, rows),
  listSessions: () => ipcRenderer.invoke('pty:list'),
  switchSession: (id) => ipcRenderer.invoke('pty:switch', id),
  renameSession: (id, name) => ipcRenderer.invoke('pty:rename', id, name),
  closeSession: (id) => ipcRenderer.invoke('pty:close', id),
  sendInput: (data) => ipcRenderer.send('pty:input', data),
  onOutput: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('pty:output', handler)
    return () => ipcRenderer.removeListener('pty:output', handler)
  },
  onExit: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  },
  onSwitched: (callback) => {
    const handler = (_event, id) => callback(id)
    ipcRenderer.on('pty:switched', handler)
    return () => ipcRenderer.removeListener('pty:switched', handler)
  },
  onRespawned: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('pty:respawned', handler)
    return () => ipcRenderer.removeListener('pty:respawned', handler)
  },
  resizePty: (cols, rows) => ipcRenderer.send('pty:resize', cols, rows),
  onMenuNewSession: (cb) => {
    const h = () => cb(); ipcRenderer.on('menu:new-session', h)
    return () => ipcRenderer.removeListener('menu:new-session', h)
  },
  onMenuCloseSession: (cb) => {
    const h = () => cb(); ipcRenderer.on('menu:close-session', h)
    return () => ipcRenderer.removeListener('menu:close-session', h)
  },
  onMenuToggleMusic: (cb) => {
    const h = () => cb(); ipcRenderer.on('menu:toggle-music', h)
    return () => ipcRenderer.removeListener('menu:toggle-music', h)
  },
  updateAudioMenu: (state) => ipcRenderer.send('menu:update-audio', state),
  itunesSearch: (params) => ipcRenderer.invoke('itunes:search', params),
  bilibiliSearch: (params) => ipcRenderer.invoke('bilibili:search', params),
  bilibiliPlayurl: (params) => ipcRenderer.invoke('bilibili:playurl', params),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  listDir: (path) => ipcRenderer.invoke('fs:listDir', path),
  onCwd: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('pty:cwd', handler)
    return () => ipcRenderer.removeListener('pty:cwd', handler)
  }
})
