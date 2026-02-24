'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Track {
  id: string
  name: string
  duration_ms: number
  uri: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
}

interface Playlist {
  id: string
  name: string
  images: { url: string }[]
  tracks: { total: number }
  description: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function apiFetch(path: string) {
  const r = await fetch(`/api/spotify?path=${encodeURIComponent(path)}`)
  if (!r.ok) throw new Error(`API error ${r.status}`)
  return r.json()
}

async function getToken(): Promise<string> {
  const r = await fetch('/api/token')
  const d = await r.json()
  return d.token
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function EqBars() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0,1,2].map(i => (
        <div key={i} className="eq-bar w-[3px] rounded-sm bg-[var(--accent)]" style={{height:'8px'}} />
      ))}
    </div>
  )
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full"
      style={{animation:'spin 0.7s linear infinite'}} />
  )
}

function ProgressBar({ position, duration, onSeek }: {
  position: number; duration: number; onSeek: (ms: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = duration > 0 ? (position / duration) * 100 : 0

  const handleClick = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    onSeek(Math.floor(x * duration))
  }

  return (
    <div ref={ref} onClick={handleClick}
      className="w-full h-1 rounded-full cursor-pointer group"
      style={{background:'var(--border)'}}>
      <div className="h-full rounded-full relative transition-all duration-100 group-hover:h-[5px]"
        style={{width:`${pct}%`, background:'var(--accent)', marginTop: 0}}>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{transform:'translate(50%,-50%)'}} />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [player, setPlayer] = useState<any>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)

  // Library
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)

  // Search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState<'playlists' | 'search'>('playlists')

  // Playback state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [queue, setQueue] = useState<Track[]>([])
  const [queueIndex, setQueueIndex] = useState(0)

  const positionTimer = useRef<any>(null)

  // ── Load token + playlists ──
  useEffect(() => {
    getToken().then(t => {
      setToken(t)
      apiFetch('/me/playlists?limit=50').then(d => setPlaylists(d.items || []))
    }).catch(e => setPlayerError('Could not get token: ' + e.message))
  }, [])

  // ── Load Spotify Web Playback SDK ──
  useEffect(() => {
    if (!token) return

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    document.body.appendChild(script)

    ;(window as any).onSpotifyWebPlaybackSDKReady = () => {
      const p = new (window as any).Spotify.Player({
        name: 'forsen.me player',
        getOAuthToken: async (cb: (t: string) => void) => {
          const t = await getToken()
          cb(t)
        },
        volume: 0.7,
      })

      p.addListener('ready', ({ device_id }: any) => {
        setDeviceId(device_id)
        setPlayerReady(true)
        // Transfer playback to this device
        fetch('/api/spotify?path=' + encodeURIComponent(`/me/player`), {
          method: 'GET'
        })
        // We'll transfer via direct API call below
        getToken().then(tk => {
          fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [device_id], play: false }),
          })
        })
      })

      p.addListener('not_ready', () => setPlayerReady(false))

      p.addListener('player_state_changed', (state: any) => {
        if (!state) return
        const t = state.track_window?.current_track
        if (t) {
          setCurrentTrack({
            id: t.id,
            name: t.name,
            uri: t.uri,
            duration_ms: t.duration_ms,
            artists: t.artists,
            album: { name: t.album.name, images: t.album.images },
          })
          setDuration(t.duration_ms)
        }
        setIsPlaying(!state.paused)
        setPosition(state.position)
      })

      p.addListener('initialization_error', ({ message }: any) => setPlayerError(message))
      p.addListener('authentication_error', ({ message }: any) => setPlayerError('Auth error: ' + message))
      p.addListener('account_error', () => setPlayerError('Spotify Premium required'))

      p.connect()
      setPlayer(p)
    }

    return () => { document.body.removeChild(script) }
  }, [token])

  // ── Position ticker ──
  useEffect(() => {
    clearInterval(positionTimer.current)
    if (isPlaying) {
      positionTimer.current = setInterval(() => {
        setPosition(p => Math.min(p + 1000, duration))
      }, 1000)
    }
    return () => clearInterval(positionTimer.current)
  }, [isPlaying, duration])

  // ── Play a track via SDK ──
  const playTrack = useCallback(async (track: Track, trackList: Track[], idx: number) => {
    if (!deviceId || !token) return
    setQueue(trackList)
    setQueueIndex(idx)

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uris: trackList.slice(idx).map(t => t.uri),
      }),
    })
  }, [deviceId, token])

  // ── Load playlist tracks ──
  const openPlaylist = async (pl: Playlist) => {
    setSelectedPlaylist(pl)
    setView('playlists')
    setLoadingTracks(true)
    setTracks([])
    try {
      const data = await apiFetch(`/playlists/${pl.id}/tracks?limit=100&fields=items(track(id,name,duration_ms,uri,artists,album))`)
      const items = (data.items || [])
        .map((i: any) => i.track)
        .filter((t: any) => t && t.uri)
      setTracks(items)
    } finally {
      setLoadingTracks(false)
    }
  }

  // ── Search ──
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const d = await apiFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=30`)
        setSearchResults(d.tracks?.items || [])
      } finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  // ── Controls ──
  const togglePlay = () => player?.togglePlay()
  const skipNext = () => player?.nextTrack()
  const skipPrev = () => player?.previousTrack()
  const seek = async (ms: number) => {
    setPosition(ms)
    await player?.seek(ms)
  }
  const setVol = async (v: number) => {
    setVolume(v)
    await player?.setVolume(v)
  }

  const artwork = currentTrack?.album?.images?.[0]?.url

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:'var(--bg)'}}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b" style={{borderColor:'var(--border)'}}>
        <span className="syne font-bold text-lg tracking-tight" style={{color:'var(--accent)'}}>
          forsen.me
        </span>
        <div className="flex gap-1 ml-4">
          {(['playlists','search'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: view === v ? 'var(--accent)' : 'var(--surface)',
                color: view === v ? '#000' : 'var(--muted)',
              }}>
              {v === 'playlists' ? 'Library' : 'Search'}
            </button>
          ))}
        </div>
        {!playerReady && !playerError && (
          <div className="ml-auto flex items-center gap-2 text-xs" style={{color:'var(--muted)'}}>
            <Spinner /> connecting…
          </div>
        )}
        {playerError && (
          <div className="ml-auto text-xs text-red-400">{playerError}</div>
        )}
        {playerReady && (
          <div className="ml-auto flex items-center gap-1.5 text-xs" style={{color:'var(--accent)'}}>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" style={{animation:'pulse-green 2s infinite'}} />
            ready
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r overflow-y-auto py-3"
          style={{borderColor:'var(--border)'}}>
          {view === 'search' ? (
            <div className="px-3">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search songs, artists…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background:'var(--surface)',
                  border:'1px solid var(--border)',
                  color:'var(--text)',
                }}
                autoFocus
              />
            </div>
          ) : (
            <div>
              <div className="px-4 mb-2 text-xs font-semibold uppercase tracking-widest"
                style={{color:'var(--muted)'}}>
                Playlists
              </div>
              {playlists.map(pl => (
                <button key={pl.id} onClick={() => openPlaylist(pl)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                  style={{
                    background: selectedPlaylist?.id === pl.id ? 'rgba(29,185,84,0.1)' : 'transparent',
                    borderLeft: selectedPlaylist?.id === pl.id ? '2px solid var(--accent)' : '2px solid transparent',
                  }}>
                  {pl.images?.[0]?.url ? (
                    <img src={pl.images[0].url} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded flex-shrink-0" style={{background:'var(--surface2)'}} />
                  )}
                  <span className="text-sm truncate" style={{
                    color: selectedPlaylist?.id === pl.id ? 'var(--accent)' : 'var(--text)'
                  }}>
                    {pl.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto" style={{animation:'slide-up 0.3s ease'}}>
          {view === 'search' ? (
            <div className="p-4">
              {searching && (
                <div className="flex justify-center pt-8"><Spinner /></div>
              )}
              {!searching && searchResults.length === 0 && query && (
                <div className="text-center pt-12 text-sm" style={{color:'var(--muted)'}}>No results for "{query}"</div>
              )}
              {!query && (
                <div className="text-center pt-16 text-sm" style={{color:'var(--muted)'}}>
                  Type to search your Spotify library
                </div>
              )}
              <TrackList
                tracks={searchResults}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={(t, i) => playTrack(t, searchResults, i)}
              />
            </div>
          ) : (
            <div className="p-4">
              {!selectedPlaylist && (
                <div className="text-center pt-16 text-sm" style={{color:'var(--muted)'}}>
                  Select a playlist
                </div>
              )}
              {selectedPlaylist && (
                <>
                  <div className="flex items-end gap-5 mb-6 pb-4 border-b" style={{borderColor:'var(--border)'}}>
                    {selectedPlaylist.images?.[0]?.url && (
                      <img src={selectedPlaylist.images[0].url}
                        className="w-24 h-24 rounded-lg shadow-lg object-cover" alt="" />
                    )}
                    <div>
                      <div className="text-xs uppercase tracking-widest mb-1" style={{color:'var(--muted)'}}>Playlist</div>
                      <div className="syne text-2xl font-bold mb-1">{selectedPlaylist.name}</div>
                      <div className="text-sm" style={{color:'var(--muted)'}}>{selectedPlaylist.tracks.total} tracks</div>
                    </div>
                  </div>
                  {loadingTracks && <div className="flex justify-center pt-8"><Spinner /></div>}
                  <TrackList
                    tracks={tracks}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlay={(t, i) => playTrack(t, tracks, i)}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Player bar ── */}
      <div className="border-t px-6 py-3" style={{
        borderColor:'var(--border)',
        background:'rgba(10,10,10,0.95)',
        backdropFilter:'blur(20px)',
      }}>
        <div className="flex items-center gap-4">

          {/* Track info */}
          <div className="flex items-center gap-3 w-56 flex-shrink-0">
            {artwork ? (
              <img src={artwork} className="w-12 h-12 rounded-md object-cover shadow-lg flex-shrink-0" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-md flex-shrink-0" style={{background:'var(--surface2)'}} />
            )}
            {currentTrack && (
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{currentTrack.name}</div>
                <div className="text-xs truncate" style={{color:'var(--muted)'}}>
                  {currentTrack.artists.map(a => a.name).join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-4">
              <button onClick={skipPrev} className="transition-opacity hover:opacity-100 opacity-60"
                style={{color:'var(--text)'}}>
                <SkipBack />
              </button>
              <button onClick={togglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{background:'var(--accent)'}}>
                <span style={{color:'#000', display:'flex', alignItems:'center'}}>
                  {isPlaying ? <Pause /> : <Play />}
                </span>
              </button>
              <button onClick={skipNext} className="transition-opacity hover:opacity-100 opacity-60"
                style={{color:'var(--text)'}}>
                <SkipFwd />
              </button>
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs tabular-nums" style={{color:'var(--muted)', minWidth:'36px', textAlign:'right'}}>
                {fmt(position)}
              </span>
              <ProgressBar position={position} duration={duration} onSeek={seek} />
              <span className="text-xs tabular-nums" style={{color:'var(--muted)', minWidth:'36px'}}>
                {fmt(duration)}
              </span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 w-32 flex-shrink-0">
            <VolumeIcon />
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={e => setVol(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer h-1" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Track List Component ──────────────────────────────────────────────────────
function TrackList({ tracks, currentTrack, isPlaying, onPlay }: {
  tracks: Track[]
  currentTrack: Track | null
  isPlaying: boolean
  onPlay: (t: Track, i: number) => void
}) {
  return (
    <div className="space-y-0.5">
      {tracks.map((track, i) => {
        const active = currentTrack?.id === track.id
        return (
          <button key={`${track.id}-${i}`} onClick={() => onPlay(track, i)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/5 group"
            style={{background: active ? 'rgba(29,185,84,0.08)' : 'transparent'}}>

            <div className="w-8 h-8 rounded flex-shrink-0 relative overflow-hidden"
              style={{background:'var(--surface2)'}}>
              {track.album?.images?.[0]?.url && (
                <img src={track.album.images[0].url} className="w-full h-full object-cover" alt="" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{background:'rgba(0,0,0,0.6)'}}>
                <PlaySmall />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium" style={{color: active ? 'var(--accent)' : 'var(--text)'}}>
                {track.name}
              </div>
              <div className="text-xs truncate" style={{color:'var(--muted)'}}>
                {track.artists.map(a => a.name).join(', ')} · {track.album.name}
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              {active && isPlaying ? <EqBars /> : null}
              <span className="text-xs" style={{color:'var(--muted)'}}>{fmt(track.duration_ms)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}


// ── Icons ─────────────────────────────────────────────────────────────────────
const Play = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
)
const Pause = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
)
const SkipBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="19,20 9,12 19,4"/><line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const SkipFwd = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,4 15,12 5,20"/><line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const VolumeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{color:'var(--muted)', flexShrink:0}}>
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const PlaySmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
    <polygon points="5,3 19,12 5,21" />
  </svg>
)
