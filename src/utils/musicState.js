// Shared music state — updated by MusicPlayer, consumed by MultiverseCanvas Audio Radar
let _state = { playing: false, trackName: null, trackPath: null }
const _listeners = new Set()

export function setMusicState(s) {
  _state = { ..._state, ...s }
  _listeners.forEach(fn => fn(_state))
}
export function getMusicState() { return _state }
export function onMusicStateChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
