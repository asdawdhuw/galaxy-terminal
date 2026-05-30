const { contextBridge, ipcRenderer, webUtils } = require('electron')

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
  },
  musicList: () => ipcRenderer.invoke('music:list'),
  saveMusicSession: (s) => ipcRenderer.invoke('music:saveSession', s),
  loadMusicSession: () => ipcRenderer.invoke('music:loadSession'),
  playMusicFile: (filePath) => ipcRenderer.send('music:playFile', filePath),
  onMusicSessionChanged: (cb) => {
    const h = () => cb(); ipcRenderer.on('music:sessionChanged', h)
    return () => ipcRenderer.removeListener('music:sessionChanged', h)
  },
  openAudioDialog: () => ipcRenderer.invoke('dialog:openAudio'),
  openMusicWindow: () => ipcRenderer.send('music:open-window'),
  openGameWindow: () => ipcRenderer.send('game:open-window'),
  toggleMusicPin: () => ipcRenderer.invoke('music:toggle-pin'),
  toggleGamePin: () => ipcRenderer.invoke('game:toggle-pin'),
  closeGameWindow: () => ipcRenderer.send('game:close'),
  getFilePath: (file) => webUtils.getPathForFile(file),
  searchLyrics: (params) => ipcRenderer.invoke('lyrics:search', params),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  searchSuggest: (query) => ipcRenderer.invoke('search:suggest', query),
  watchDir: (path) => ipcRenderer.invoke('fs:watch', path),
  onFsChanged: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('fs:changed', handler)
    return () => ipcRenderer.removeListener('fs:changed', handler)
  }
})
