import { useState, useCallback, useRef, useEffect } from 'react'

/* ================================================================== */
/*  Music Audio Stream — WBI-signed, stream:// protocol, Referer    */
/* ================================================================== */

let _player = null
function getPlayer() {
  if (!_player) {
    _player = new Audio()
    _player.crossOrigin = 'anonymous'
    _player.preload = 'auto'
  }
  return _player
}

export default function useMusicController() {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)

  const currentRef = useRef(null)
  const resultsRef = useRef([])
  const playHistoryRef = useRef([]) // stack of previous bvids for prev()
  currentRef.current = currentTrack
  resultsRef.current = results

  // ---- MediaSession API — OS media keys & overlay ----
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const track = currentTrack
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }
    const artist = track.artist || ''
    const title = track.title || track.name || ''
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Galaxy Terminal',
      artwork: track.cover
        ? [{ src: track.cover.replace(/^https?:/, 'https:'), sizes: '240x240', type: 'image/jpeg' }]
        : []
    })
    navigator.mediaSession.setActionHandler('play', () => resume())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('previoustrack', () => prev())
  }, [currentTrack])

  // ---- Player event listeners ----
  useEffect(() => {
    const player = getPlayer()
    function onMeta() { if (player.duration && isFinite(player.duration)) setDuration(player.duration) }
    function onDuration() { if (player.duration && isFinite(player.duration)) setDuration(player.duration) }
    player.addEventListener('loadedmetadata', onMeta)
    player.addEventListener('durationchange', onDuration)
    return () => {
      player.removeEventListener('loadedmetadata', onMeta)
      player.removeEventListener('durationchange', onDuration)
    }
  }, [])

  async function playTrack(track) {
    if (!track?.bvid) return false
    setError(null)
    setDuration(0)

    // Push current track to history before switching
    if (currentRef.current?.bvid && currentRef.current.bvid !== track.bvid) {
      playHistoryRef.current.push(currentRef.current.bvid)
      // Keep history bounded
      if (playHistoryRef.current.length > 50) playHistoryRef.current.shift()
    }

    // Get WBI-signed audio URL from main process
    const r = await window.terminal?.bilibiliPlayurl?.({ bvid: track.bvid })
    if (!r?.ok) {
      setError(r?.error || 'Playback failed')
      return false
    }

    const player = getPlayer()
    if (!player.paused) player.pause()
    player.src = `stream://audio?url=${encodeURIComponent(r.url)}`
    player.currentTime = 0
    try {
      await player.play()
      setCurrentTrack(track)
      setPlaying(true)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  // Find next track in results by the same artist (loops within artist group)
  function findNextByArtist(track) {
    const results = resultsRef.current
    const artist = (track.artist || '').trim().toLowerCase()
    if (!artist) {
      // No artist info — fall back to sequential next in results
      const idx = results.findIndex((t) => t.bvid === track.bvid)
      return results[idx + 1] || results[0] || null
    }
    const sameArtist = results.filter((t) => (t.artist || '').trim().toLowerCase() === artist)
    if (sameArtist.length <= 1) {
      // Only one track by this artist — sequential next
      const idx = results.findIndex((t) => t.bvid === track.bvid)
      return results[idx + 1] || results[0] || null
    }
    const curIdx = sameArtist.findIndex((t) => t.bvid === track.bvid)
    const nextInGroup = sameArtist[(curIdx + 1) % sameArtist.length]
    return nextInGroup && nextInGroup.bvid !== track.bvid ? nextInGroup : null
  }

  // Auto-radio: when a track ends, play next by the same artist
  const autoRadio = useCallback(async () => {
    const prev = currentRef.current
    if (!prev) return
    const next = findNextByArtist(prev)
    if (next) {
      console.log('[Radio] Next up:', next.title, '|', next.artist)
      await playTrack(next)
    } else {
      console.log('[Radio] No more tracks')
    }
  }, [])

  useEffect(() => {
    const player = getPlayer()
    player.addEventListener('ended', autoRadio)
    return () => player.removeEventListener('ended', autoRadio)
  }, [autoRadio])

  // ---- Explicit next / prev ----
  const next = useCallback(async () => {
    const cur = currentRef.current
    if (!cur) return
    const nextTrack = findNextByArtist(cur)
    if (nextTrack) {
      await playTrack(nextTrack)
    }
  }, [])

  const prev = useCallback(async () => {
    // Go to previous track in history, or previous in results
    if (playHistoryRef.current.length > 0) {
      const prevBvid = playHistoryRef.current.pop()
      const prevTrack = resultsRef.current.find((t) => t.bvid === prevBvid)
      if (prevTrack) {
        await playTrack(prevTrack)
        return
      }
    }
    // Fallback: previous in results list
    const cur = currentRef.current
    if (!cur) return
    const idx = resultsRef.current.findIndex((t) => t.bvid === cur.bvid)
    if (idx > 0) {
      await playTrack(resultsRef.current[idx - 1])
    } else if (resultsRef.current.length > 0) {
      await playTrack(resultsRef.current[resultsRef.current.length - 1])
    }
  }, [])

  const search = useCallback(async (query) => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    setError(null)
    try {
      const r = await window.terminal?.bilibiliSearch?.({ keyword: query })
      if (!r?.ok) throw new Error(r?.error || 'Search failed')
      setResults(r.results || [])
    } catch (e) {
      setResults([])
      setError(e.message)
    }
    setSearching(false)
  }, [])

  const play = useCallback(async (track) => {
    setError(null)
    await playTrack(track)
  }, [])

  const pause = useCallback(() => { getPlayer().pause(); setPlaying(false) }, [])
  const resume = useCallback(() => { getPlayer().play().catch(() => {}); setPlaying(true) }, [])
  const stop = useCallback(() => {
    const p = getPlayer()
    p.pause(); p.currentTime = 0
    setPlaying(false); setCurrentTrack(null)
    setDuration(0)
  }, [])

  const seek = useCallback((time) => {
    const p = getPlayer()
    if (p && isFinite(time)) p.currentTime = time
  }, [])

  const getTime = useCallback(() => getPlayer().currentTime, [])
  const getDuration = useCallback(() => getPlayer().duration, [])

  return {
    search, results, searching,
    play, pause, resume, stop,
    next, prev,
    playing, currentTrack, error,
    seek, getTime, getDuration, duration
  }
}
