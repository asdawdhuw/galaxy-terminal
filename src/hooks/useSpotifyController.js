import { useState, useCallback, useRef, useEffect } from 'react'

/* ================================================================== */
/*  Spotify Web API controller                                         */
/*                                                                     */
/*  TOKEN EXCHANGE HAPPENS IN MAIN PROCESS (bypasses CSP)              */
/* ================================================================== */

const CLIENT_ID = 'fa0592f0132346f8bcd7f28a3f8438f7'
const REDIRECT_URI = 'http://127.0.0.1:8000/callback'
const SCOPES = 'streaming user-read-playback-state user-modify-playback-state'

function spotifyApi(path, token, opts = {}) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...opts
  }).then((r) => (r.status === 204 ? null : r.json()))
}

/* ---- PKCE helpers ---- */

function generateCodeVerifier() {
  const arr = new Uint8Array(64)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/* ================================================================== */
/*  Hook                                                               */
/* ================================================================== */

export default function useSpotifyController() {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [deviceId, setDeviceId] = useState(null)
  const tokenRef = useRef(sessionStorage.getItem('spotify_token') || null)
  const deviceRef = useRef(null)

  // Auto-check existing token on mount
  useEffect(() => {
    if (tokenRef.current) setConnected(true)
  }, [])

  // Listen for token events pushed from main process (backup channel)
  useEffect(() => {
    const u1 = window.terminal?.onSpotifyTokenSuccess?.(({ access_token, refresh_token }) => {
      console.log('🚀🚀🚀 [Renderer] Token success from main:', access_token?.slice(0, 15) + '...')
      tokenRef.current = access_token
      sessionStorage.setItem('spotify_token', access_token)
      if (refresh_token) sessionStorage.setItem('spotify_refresh', refresh_token)
      setConnected(true)
      setConnecting(false)
      setError(null)
    })
    const u2 = window.terminal?.onSpotifyTokenError?.((msg) => {
      console.error('❌❌❌ [Renderer] Token error from main:', msg)
      setError(msg)
      setConnecting(false)
    })
    return () => { u1?.(); u2?.() }
  }, [])

  /* ---- OAuth connect ---- */
  const connect = useCallback(async () => {
    if (!CLIENT_ID) { setError('Client ID not set'); return false }
    setConnecting(true)
    setError(null)

    // Try refresh first (via main process to avoid CSP)
    const refreshToken = sessionStorage.getItem('spotify_refresh')
    if (refreshToken) {
      try {
        const j = await window.terminal?.refreshSpotifyToken?.({ refreshToken, clientId: CLIENT_ID })
        if (j?.access_token) {
          tokenRef.current = j.access_token
          sessionStorage.setItem('spotify_token', j.access_token)
          if (j.refresh_token) sessionStorage.setItem('spotify_refresh', j.refresh_token)
          setConnected(true)
          setConnecting(false)
          return true
        }
        // Refresh failed — clear and re-auth
        sessionStorage.removeItem('spotify_refresh')
        sessionStorage.removeItem('spotify_token')
        console.log('[Spotify] Refresh expired, starting full OAuth...')
      } catch (_) {}
    }

    // Full PKCE OAuth → main process handles EVERYTHING
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES
    })
    const authUrl = `https://accounts.spotify.com/authorize?${params}`
    console.log('[Spotify] Opening auth window (main process handles token)...')

    // Main process: opens window → captures code → exchanges token → returns result
    let result
    try {
      result = await window.terminal?.openSpotifyAuth?.({
        authUrl, clientId: CLIENT_ID, redirectUri: REDIRECT_URI, codeVerifier: verifier
      })
    } catch (e) {
      console.error('[Spotify] IPC error:', e)
      setError('IPC error: ' + e.message)
      setConnecting(false)
      return false
    }

    console.log('🚀🚀🚀 [Renderer] Auth result:', result?.access_token ? '✅ TOKEN OK' : result?.error ? `❌ ${result.error}` : '❓ empty')

    if (result?.access_token) {
      tokenRef.current = result.access_token
      sessionStorage.setItem('spotify_token', result.access_token)
      if (result.refresh_token) sessionStorage.setItem('spotify_refresh', result.refresh_token)
      setConnected(true)
      setConnecting(false)
      setError(null)
      return true
    }

    if (result?.error) setError(result.error)
    else setError('No token received')
    setConnecting(false)
    return false
  }, [])

  /* ---- search ---- */
  const search = useCallback(async (query) => {
    if (!query.trim() || !tokenRef.current) return
    setSearching(true)
    try {
      const data = await spotifyApi(`/search?q=${encodeURIComponent(query)}&type=track&limit=20`, tokenRef.current)
      const tracks = (data?.tracks?.items || []).map((t) => ({
        id: t.id, uri: t.uri, name: t.name,
        artist: t.artists.map((a) => a.name).join(', '),
        album: t.album?.name, duration: t.duration_ms,
        image: t.album?.images?.[2]?.url
      }))
      setResults(tracks)
    } catch (_) { setResults([]) }
    setSearching(false)
  }, [])

  /* ---- device ---- */
  const fetchDevices = useCallback(async () => {
    if (!tokenRef.current) return null
    try {
      const data = await spotifyApi('/me/player/devices', tokenRef.current)
      const devices = data?.devices || []
      const desktop = devices.find((d) => d.type === 'Computer') || devices[0]
      if (desktop) { deviceRef.current = desktop.id; setDeviceId(desktop.id) }
      return desktop?.id || null
    } catch (_) { return null }
  }, [])

  /* ---- play ---- */
  const play = useCallback(async (uri) => {
    if (!tokenRef.current) return false
    const did = deviceRef.current || (await fetchDevices())
    if (!did) { console.warn('[Spotify] No active device — open Spotify desktop'); return false }
    try {
      await spotifyApi('/me/player/play', tokenRef.current, {
        method: 'PUT', body: JSON.stringify({ uris: [uri], device_id: did })
      })
      return true
    } catch (_) { return false }
  }, [fetchDevices])

  /* ---- pause ---- */
  const pause = useCallback(async () => {
    if (!tokenRef.current) return
    try { await spotifyApi('/me/player/pause', tokenRef.current, { method: 'PUT' }) } catch (_) {}
  }, [])

  return { connect, connected, connecting, error, deviceId, search, results, searching, play, pause }
}
