import { useState, useCallback, useRef, useEffect } from 'react'

/* ================================================================== */
/*  Music Audio Stream — WBI-signed, stream:// protocol, Referer    */
/* ================================================================== */

let _player = null
function getPlayer() {
  if (!_player) {
    _player = new Audio()
    _player.crossOrigin = 'anonymous'
  }
  return _player
}

export default function useMusicController() {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  const currentRef = useRef(null)
  const resultsRef = useRef([])
  currentRef.current = currentTrack
  resultsRef.current = results

  async function playTrack(track) {
    if (!track?.bvid) return false
    setError(null)

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

  // Auto-radio: move to next track in current results
  const autoRadio = useCallback(async () => {
    const prev = currentRef.current
    if (!prev) return

    const idx = resultsRef.current.findIndex((t) => t.bvid === prev.bvid)
    const next = resultsRef.current[idx + 1] || resultsRef.current[0]
    if (next && next.bvid !== prev.bvid) {
      console.log('[Radio] Next up:', next.title)
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
  }, [])

  const getTime = useCallback(() => getPlayer().currentTime, [])

  return { search, results, searching, play, pause, resume, stop, playing, currentTrack, error, getTime }
}
