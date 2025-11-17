import React, { useState, useEffect, useMemo, useRef } from 'react'
import { API_URL, endMeeting as endMeetingApi, getParticipants, joinMeeting, leaveMeeting } from '../utils/api'
import { io, Socket } from 'socket.io-client'
import ParticipantsSidebar from '../components/ParticipantsSidebar'
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhone, FiGrid, FiMaximize2, FiList, FiUsers, FiSettings, FiMoon, FiSun, FiMoreVertical, FiLink } from 'react-icons/fi'

const Call: React.FC = () => {
  const savedMeeting = (() => {
    try { return JSON.parse(localStorage.getItem('rc_current_meeting') || 'null') } catch { return null }
  })()
  const [isMuted, setIsMuted] = useState(!(savedMeeting?.audioOn ?? true))
  const [cameraOff, setCameraOff] = useState(!(savedMeeting?.cameraOn ?? true))
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showEndCallModal, setShowEndCallModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
   const [showShare, setShowShare] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  const [elapsed, setElapsed] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const peerInfoRef = useRef<Map<string, { userId?: string; name?: string }>>(new Map())
  const peerStreamsRef = useRef<Map<string, MediaStream>>(new Map())

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showSettings && !target.closest('[data-settings-dropdown]')) {
        setShowSettings(false)
      }
      if (showMoreOptions && !target.closest('[data-more-options]')) {
        setShowMoreOptions(false)
      }
    }

    // Use click instead of mousedown so menu items can receive the click
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showSettings, showMoreOptions])

  useEffect(() => {
    // Add scrollbar hiding styles
    const style = document.createElement('style')
    style.textContent = `
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Meeting timer like G‑Meet
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const hhmmss = useMemo(() => {
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
    const s = Math.floor(elapsed % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }, [elapsed])

  // Extract meeting id from query and canonicalize savedMeeting fallback
  const urlParams = new URLSearchParams(window.location.search)
  const queryMeetingId = urlParams.get('m') || savedMeeting?.id || ''
  const shareUrl = savedMeeting?.shareUrl || (queryMeetingId ? `${window.location.origin}/call?m=${queryMeetingId}` : '')
  const hasAuth = (() => { try { return !!JSON.parse(localStorage.getItem('auth')||'null') } catch { return false } })()

  // Resolve current user id (auth or guest) and persist guest id
  const resolveUserId = () => {
    let userId = ''
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || 'null')
      userId = auth?.user?._id || auth?._id || auth?.userId || auth?.id || ''
    } catch {}
    if (!userId) {
      let gid = localStorage.getItem('rc_guest_id')
      if (!gid) {
        gid = `guest_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
        localStorage.setItem('rc_guest_id', gid)
      }
      userId = gid
    }
    return userId
  }
  const userId = resolveUserId()

  // If no savedMeeting but we have query id, construct a lightweight one (guest)
  useEffect(() => {
    if (!savedMeeting && queryMeetingId) {
      const guestName = localStorage.getItem('rc_name') || 'Guest'
      const fallback = { id: queryMeetingId, host: false, name: guestName, cameraOn: true, audioOn: true, shareUrl }
      localStorage.setItem('rc_current_meeting', JSON.stringify(fallback))
    }
    // Redirect to canonical share link if URL missing m but we have id
    if (savedMeeting && !urlParams.get('m') && savedMeeting.id) {
      window.location.replace(`/call?m=${encodeURIComponent(savedMeeting.id)}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Participants state loaded from backend
  type ViewParticipant = { id: number; name: string; initials: string; isSpeaking: boolean }
  const [participants, setParticipants] = useState<ViewParticipant[]>([])
  const [participantsError, setParticipantsError] = useState<string>('')
  type RemotePeer = { socketId: string; userId?: string; name?: string; stream: MediaStream }
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([])

  // Join the room on mount (host or guest) and leave on unmount/navigation
  useEffect(() => {
    if (!queryMeetingId || !userId) return
    let ended = false
    const endedRef = { current: false }

    const doJoin = async () => {
      try {
        const name = (savedMeeting?.name || localStorage.getItem('rc_name') || 'Guest').toString()
        const res: any = await joinMeeting({ roomId: queryMeetingId, userId, name })
        if (res?.participants && Array.isArray(res.participants)) {
          const mapped: ViewParticipant[] = res.participants.map((p: any, idx: number) => {
            const nm: string = p.name || p.userId || `User${idx+1}`
            return {
              id: idx + 1,
              name: nm,
              initials: nm.split(' ').map((s: string)=>s[0]).slice(0,2).join('').toUpperCase(),
              isSpeaking: false
            }
          })
          setParticipants(mapped)
        }
      } catch (e) {
        // Non-blocking
      }
    }

    // Prefer sendBeacon for unload; fallback to fetch keepalive
    const sendBeaconJson = (path: string, payload: any) => {
      try {
        const url = `${API_URL}/${path.replace(/^\//,'')}`
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
        const ok = navigator.sendBeacon(url, blob)
        if (!ok) throw new Error('beacon-failed')
      } catch {
        // Fallback
        fetch(`${API_URL}/${path.replace(/^\//,'')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(()=>{})
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show prompt
      e.preventDefault()
      e.returnValue = ''
      const meta = (() => { try { return JSON.parse(localStorage.getItem('rc_current_meeting')||'null') } catch { return null } })()
      const isHost = !!meta?.host
      if (!endedRef.current) {
        if (isHost) sendBeaconJson('meet/end', { roomId: queryMeetingId })
        else sendBeaconJson('meet/leave', { roomId: queryMeetingId, userId })
      }
    }

    const handlePageHide = () => {
      const meta = (() => { try { return JSON.parse(localStorage.getItem('rc_current_meeting')||'null') } catch { return null } })()
      const isHost = !!meta?.host
      if (!endedRef.current) {
        if (isHost) sendBeaconJson('meet/end', { roomId: queryMeetingId })
        else sendBeaconJson('meet/leave', { roomId: queryMeetingId, userId })
      }
    }

    doJoin()
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      if (!ended && queryMeetingId && userId) {
        // best-effort on component unmount within SPA
        leaveMeeting({ roomId: queryMeetingId, userId }).catch(()=>{})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMeetingId, userId])

  useEffect(() => {
    if (!queryMeetingId) return
    let active = true
    const fetchOnce = async () => {
      try {
        const data: any = await getParticipants(queryMeetingId)
        if (!active) return
        const raw = Array.isArray(data.participants) ? data.participants : []
        const mapped: ViewParticipant[] = raw.map((p: any, idx: number) => {
          const nm: string = p.name || p.userId || `User${idx+1}`
          return {
            id: idx + 1,
            name: nm,
            initials: nm.split(' ').map((s: string)=>s[0]).slice(0,2).join('').toUpperCase(),
            isSpeaking: false
          }
        })
        // Merge with remote peers to include connected WebRTC participants
        const remoteMapped: ViewParticipant[] = remotePeers.map((rp, idx) => {
          const nm = rp.name || rp.userId || `Remote${idx+1}`
          return {
            id: mapped.length + idx + 1,
            name: nm,
            initials: nm.split(' ').map((s: string)=>s[0]).slice(0,2).join('').toUpperCase(),
            isSpeaking: false
          }
        })
        // Deduplicate by userId if present
        const all = [...mapped, ...remoteMapped]
        const seen = new Set<string>()
        const unique = all.filter(p => {
          const key = p.name.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setParticipants(unique)
        setParticipantsError('')
      } catch (e: any) {
        if (!active) return
        setParticipantsError(e?.message || 'Failed to load participants')
      }
    }
    fetchOnce()
    const id = setInterval(fetchOnce, 5000)
    return () => { active = false; clearInterval(id) }
  }, [queryMeetingId, remotePeers])

  // Default open participants sidebar if unauthenticated
  useEffect(() => {
    if (!hasAuth) setShowParticipants(true)
  }, [hasAuth])

  const myName = savedMeeting?.name || localStorage.getItem('rc_name') || 'You'
  const myInitials = myName.split(' ').map((s: string) => s[0]).slice(0,2).join('').toUpperCase() || 'YO'
  const [layout, setLayout] = useState<'tiled' | 'spotlight' | 'sidebar'>('sidebar')

  // Start/stop local media based on camera toggle
  useEffect(() => {
    let current: MediaStream | null = null
    const ensureStream = async () => {
      try {
        if (!cameraOff && !current) {
          const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          current = s
          setStream(s)
          if (videoRef.current) {
            ;(videoRef.current as any).srcObject = s
          }
          // apply current mute preference
          s.getAudioTracks().forEach(t => (t.enabled = !isMuted))
        }
        if (cameraOff && stream) {
          stream.getTracks().forEach(t => t.stop())
          setStream(null)
        }
      } catch (e) {
        console.warn('getUserMedia failed', e)
      }
    }
    ensureStream()
    return () => {
      // cleanup when unmount or re-run
      if (current) current.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOff])

  // Reflect mute toggle to existing stream
  useEffect(() => {
    if (stream) stream.getAudioTracks().forEach(t => (t.enabled = !isMuted))
  }, [isMuted, stream])

  // Socket.IO + WebRTC mesh connections
  useEffect(() => {
    if (!queryMeetingId) return
    const SOCKET_URL = API_URL.replace(/\/api\/v1$/, '')
    const socket = io(SOCKET_URL, { transports: ['websocket'], withCredentials: true })
    socketRef.current = socket

    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
      ],
    }

    const addLocalTracks = (pc: RTCPeerConnection) => {
      if (!stream) return
      try {
        stream.getTracks().forEach(t => { try { pc.addTrack(t, stream) } catch {} })
      } catch {}
    }

    const cleanupPeer = (sid: string) => {
      const pc = peersRef.current.get(sid)
      if (pc) {
        try { pc.onicecandidate = null; pc.ontrack = null } catch {}
        try { pc.getSenders().forEach(s => { try { pc.removeTrack(s) } catch {} }) } catch {}
        try { pc.close() } catch {}
      }
      peersRef.current.delete(sid)
      peerInfoRef.current.delete(sid)
      peerStreamsRef.current.delete(sid)
      setRemotePeers(prev => prev.filter(p => p.socketId !== sid))
    }

    const createPeer = async (targetSocketId: string, initiator: boolean, meta?: { userId?: string; name?: string }) => {
      if (peersRef.current.has(targetSocketId)) return peersRef.current.get(targetSocketId)!
      const pc = new RTCPeerConnection(rtcConfig)
      peersRef.current.set(targetSocketId, pc)
      if (meta) peerInfoRef.current.set(targetSocketId, meta)
      addLocalTracks(pc)

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit('signal', { to: targetSocketId, data: { type: 'candidate', candidate: ev.candidate } })
        }
      }
      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams
        if (!remoteStream) return
        peerStreamsRef.current.set(targetSocketId, remoteStream)
        const info = peerInfoRef.current.get(targetSocketId)
        setRemotePeers(prev => {
          const existing = prev.find(p => p.socketId === targetSocketId)
          if (existing) return prev.map(p => p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p)
          return [...prev, { socketId: targetSocketId, userId: info?.userId, name: info?.name, stream: remoteStream }]
        })
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          cleanupPeer(targetSocketId)
        }
      }

      if (initiator) {
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit('signal', { to: targetSocketId, data: { type: 'offer', sdp: offer.sdp } })
        } catch {}
      }
      return pc
    }

    const handleSignal = async ({ from, data }: { from: string; data: any }) => {
      let pc = peersRef.current.get(from)
      if (!pc) pc = await createPeer(from, false)
      if (!pc) return
      try {
        if (data?.type === 'offer') {
          await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })
          addLocalTracks(pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('signal', { to: from, data: { type: 'answer', sdp: answer.sdp } })
        } else if (data?.type === 'answer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
        } else if (data?.type === 'candidate') {
          if (data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        }
      } catch {}
    }

    socket.on('connect', () => {
      const name = (savedMeeting?.name || localStorage.getItem('rc_name') || 'Guest').toString()
      socket.emit('join-room', { roomId: queryMeetingId, userId, name })
    })
    socket.on('user-joined', ({ userId: uid, name: uname, socketId }: { userId?: string; name?: string; socketId: string }) => {
      peerInfoRef.current.set(socketId, { userId: uid, name: uname })
      createPeer(socketId, true, { userId: uid, name: uname })
    })
    socket.on('signal', handleSignal)
    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      cleanupPeer(socketId)
    })
    socket.on('meeting-ended', () => {
      try { peersRef.current.forEach((_, sid) => cleanupPeer(sid)) } finally { window.location.href = '/thankyou' }
    })

    return () => {
      try { socket.emit('leave-room', { roomId: queryMeetingId, userId }) } catch {}
      try { socket.off('user-joined'); socket.off('signal'); socket.off('user-left'); socket.off('meeting-ended'); socket.disconnect() } catch {}
      peersRef.current.forEach((_, sid) => cleanupPeer(sid))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMeetingId, userId, stream])

  // Reusable button with modern UI
  const IconBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {active?: boolean; danger?: boolean; success?: boolean; label: string}> = ({active, danger, success, label, className = '', children, ...props}) => {
    const base = `group relative p-3 rounded-full backdrop-blur-md select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${darkMode ? 'focus-visible:ring-green-500 focus-visible:ring-offset-gray-900' : 'focus-visible:ring-green-600 focus-visible:ring-offset-white'} transition transform duration-150 ease-in-out hover:scale-105`;
    const schemes = danger
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : success
        ? 'bg-green-600 hover:bg-green-700 text-white'
        : active
          ? 'bg-blue-600 hover:bg-blue-700 text-white'
          : darkMode
            ? 'bg-gray-700/70 hover:bg-gray-600/80 text-white'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900';
    return (
      <button aria-label={label} title={label} className={`${base} ${schemes} ${className}`} {...props}>
        {children}
      </button>
    )
  }

  return (
    <div className={`h-screen flex flex-col transition-colors duration-200 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between border-b transition-colors duration-200 ${darkMode ? 'bg-gray-900/70 border-gray-800 backdrop-blur-md' : 'bg-white/70 border-gray-200 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
          <h1 className={`text-sm sm:text-lg font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            RuralCall Meeting
          </h1>
          <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{hhmmss}</span>
          {queryMeetingId && (
            <span className={`hidden md:inline text-[11px] px-2 py-0.5 rounded-full ml-1 font-mono ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>ID: {queryMeetingId}</span>
          )}
        </div>
        <button
          onClick={() => setShowParticipants(v => !v)}
          className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full transition ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {showParticipants ? 'Hide' : 'Show'} participants · {participants.length}
        </button>
      </div>

      {/* Main Video Area */}
  <div className={`flex-1 p-2 sm:p-4 transition-colors duration-200 overflow-hidden ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="h-full overflow-hidden">
          {layout === 'sidebar' && (
            <div className={`grid gap-2 sm:gap-4 h-full overflow-hidden ${showParticipants ? 'grid-cols-1 lg:grid-cols-4' : 'grid-cols-1'}`}>
              {/* Main Video */}
              <div className={`${showParticipants ? 'lg:col-span-3' : 'col-span-1'} rounded-xl sm:rounded-2xl overflow-hidden shadow-lg relative group transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <div className="w-full h-full bg-linear-to-br from-green-600 to-green-800 flex items-center justify-center relative overflow-hidden">
                  {stream && !cameraOff ? (
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-green-700 flex items-center justify-center mb-2 sm:mb-4 ring-4 ring-green-500/30">
                      <span className="text-2xl sm:text-4xl font-bold text-white">{myInitials}</span>
                    </div>
                    <h2 className="text-white text-lg sm:text-xl font-semibold">{myName}</h2>
                    <p className="text-green-200 text-xs sm:text-sm">Your video</p>
                  </div>
                  )}
                  {cameraOff && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="text-center">
                        <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm10.5-2L9 4.5 7.5 3h5z" />
                        </svg>
                        <p className="text-white text-xs sm:text-sm font-medium">Camera off</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Remote peers thumbnail rail */}
              {remotePeers.length > 0 && (
                <div className={`mt-2 ${showParticipants ? 'lg:col-span-3' : 'col-span-1'}`}>
                  <div className="flex gap-2 flex-wrap">
                    {remotePeers.map((rp) => (
                      <div key={rp.socketId} className={`relative w-40 h-24 rounded-md overflow-hidden ${darkMode ? 'bg-gray-900/40' : 'bg-gray-200/60'}`}>
                        <video autoPlay playsInline className="w-full h-full object-cover" ref={(el)=>{ if (el && rp.stream) (el as any).srcObject = rp.stream }} />
                        <div className={`absolute bottom-0 left-0 right-0 text-[10px] px-1 py-0.5 truncate ${darkMode ? 'bg-black/40 text-white' : 'bg-white/60 text-gray-900'}`}>
                          {rp.name || rp.userId || 'Participant'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participants Sidebar - Conditional */}
              {showParticipants && (
                <div className="lg:col-span-1 overflow-y-auto overflow-x-hidden pr-0 sm:pr-2 scrollbar-hide">
                  {participantsError && (
                    <div className="text-xs text-red-500 p-2">{participantsError}</div>
                  )}
                  <ParticipantsSidebar participants={participants} />
                </div>
              )}
            </div>
 
          )}

          {layout === 'tiled' && (
            <div className="w-full h-full overflow-y-auto overflow-x-hidden pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 auto-rows-max">
                {participants.map((p) => (
                  <div key={p.id} className={`rounded-xl sm:rounded-2xl overflow-hidden shadow-lg aspect-video flex items-center justify-center relative transition-all duration-200 hover:shadow-xl active:scale-95 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    <div className="flex flex-col items-center justify-center overflow-hidden w-full h-full p-2">
                      <div className={`w-10 h-10 sm:w-14 sm:h-14 lg:w-20 lg:h-20 rounded-full flex items-center justify-center mb-1 sm:mb-2 transition-all ${p.isSpeaking ? 'bg-linear-to-tr from-yellow-400 to-amber-500 ring-4 ring-yellow-300/60 animate-pulse' : darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                        <span className="text-sm sm:text-lg lg:text-2xl font-bold text-white">{p.initials}</span>
                      </div>
                      <h3 className={`text-xs sm:text-sm font-semibold text-center px-1 truncate w-full ${darkMode ? 'text-white' : 'text-gray-900'}`}>{p.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {layout === 'spotlight' && (
            <div className="h-full flex flex-col gap-2 sm:gap-3 overflow-hidden">
              {/* Main Speaker */}
              <div className={`rounded-xl sm:rounded-2xl overflow-hidden shadow-lg flex-1 flex items-center justify-center transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <div className="text-center overflow-hidden p-4">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-green-700 flex items-center justify-center mb-2 sm:mb-4 mx-auto ring-4 ring-green-500/50">
                    <span className="text-3xl sm:text-4xl font-bold text-white">{participants[0].initials}</span>
                  </div>
                  <h2 className={`text-lg sm:text-2xl font-semibold truncate px-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{participants[0].name}</h2>
                  <p className={`text-xs sm:text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Speaking</p>
                </div>
              </div>

              {/* Participant Thumbnails - Scrollable */}
              <div className="overflow-x-auto overflow-y-hidden scrollbar-hide pb-2">
                <div className="flex gap-2 sm:gap-3 min-w-max px-1">
                  {participants.slice(1, 13).map((p) => (
                    <div key={p.id} className={`rounded-lg sm:rounded-xl w-24 sm:w-28 lg:w-32 h-20 sm:h-24 lg:h-28 flex items-center justify-center transition-all duration-200 hover:shadow-lg active:scale-95 cursor-pointer shrink-0 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                      <div className="flex flex-col items-center justify-center overflow-hidden w-full h-full p-2">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center mb-1 transition-all ${p.isSpeaking ? 'bg-linear-to-tr from-yellow-400 to-amber-500 ring-4 ring-yellow-300/60 animate-pulse' : darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
                          <span className="text-sm sm:text-base lg:text-lg font-bold text-white">{p.initials}</span>
                        </div>
                        <div className={`text-xs truncate w-full text-center px-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{p.name.split(' ')[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={`px-2 sm:px-4 py-3 sm:py-4 border-t transition-colors duration-200 relative ${darkMode ? 'bg-gray-900/70 border-gray-800 backdrop-blur-md' : 'bg-white/70 border-gray-200 backdrop-blur-md'}`}>
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {/* Mobile: Essential Controls Only (Mic, Camera, End Call, More) */}
          <div className="flex md:hidden items-center gap-2 w-full justify-center">
            {/* Microphone */}
            <IconBtn onClick={() => setIsMuted(!isMuted)} danger={isMuted} label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <FiMicOff className="w-6 h-6" /> : <FiMic className="w-6 h-6" />}
            </IconBtn>

            {/* Camera */}
            <IconBtn onClick={() => setCameraOff(!cameraOff)} danger={cameraOff} label={cameraOff ? 'Turn on camera' : 'Turn off camera'}>
              {cameraOff ? <FiVideoOff className="w-6 h-6" /> : <FiVideo className="w-6 h-6" />}
            </IconBtn>

            {/* More Options (3 dots) */}
            <div className="relative" data-more-options>
              <IconBtn onClick={() => setShowMoreOptions(!showMoreOptions)} active={showMoreOptions} label="More options">
                <FiMoreVertical className="w-6 h-6" />
              </IconBtn>
            </div>

            {/* End Call */}
            <IconBtn onClick={() => setShowEndCallModal(true)} danger label="Leave call">
              <FiPhone className="w-6 h-6" />
            </IconBtn>
          </div>

          {/* Desktop: All Controls Visible */}
          <div className="hidden md:flex items-center gap-3 w-full justify-center">
            {/* Primary Controls */}
            <div className="flex items-center gap-2">
              {/* Microphone */}
              <IconBtn onClick={() => setIsMuted(!isMuted)} danger={isMuted} label={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <FiMicOff className="w-6 h-6" /> : <FiMic className="w-6 h-6" />}
              </IconBtn>

              {/* Camera */}
              <IconBtn onClick={() => setCameraOff(!cameraOff)} danger={cameraOff} label={cameraOff ? 'Turn on camera' : 'Turn off camera'}>
                {cameraOff ? <FiVideoOff className="w-6 h-6" /> : <FiVideo className="w-6 h-6" />}
              </IconBtn>

              {/* Screen Share */}
              <IconBtn onClick={() => setIsScreenSharing(!isScreenSharing)} success={isScreenSharing} label={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
                <FiMonitor className="w-6 h-6" />
              </IconBtn>
            </div>

            <div className={`w-px h-8 ${darkMode ? 'bg-gray-600' : 'bg-gray-400'}`} />

            {/* Secondary Controls */}
            <div className="flex items-center gap-2">
              {/* Show/Hide Participants */}
              <IconBtn onClick={() => setShowParticipants(!showParticipants)} active={showParticipants} label={showParticipants ? 'Hide participants' : 'Show participants'}>
                <FiUsers className="w-6 h-6" />
              </IconBtn>

              {/* Layout Switcher */}
              <IconBtn onClick={() => setLayout('sidebar')} active={layout === 'sidebar'} label="Sidebar layout">
                <FiList className="w-6 h-6" />
              </IconBtn>

              <IconBtn onClick={() => setLayout('tiled')} active={layout === 'tiled'} label="Grid layout">
                <FiGrid className="w-6 h-6" />
              </IconBtn>

              <IconBtn onClick={() => setLayout('spotlight')} active={layout === 'spotlight'} label="Spotlight layout">
                <FiMaximize2 className="w-6 h-6" />
              </IconBtn>
            </div>

            <div className={`w-px h-8 ${darkMode ? 'bg-gray-600' : 'bg-gray-400'}`} />

            {/* Settings */}
            <div className="relative" data-settings-dropdown>
              <IconBtn onClick={() => setShowSettings(!showSettings)} success={showSettings} label="Settings">
                <FiSettings className="w-6 h-6" />
              </IconBtn>
            </div>

            {/* Share Link (Desktop) */}
            {shareUrl && (
              <div className="relative" data-share-link>
                <IconBtn onClick={() => setShowShare(s => !s)} active={showShare} label="Share link">
                  <FiLink className="w-6 h-6" />
                </IconBtn>
                {showShare && (
                  <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 w-[min(360px,90vw)] p-3 rounded-xl shadow-xl z-50 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`}>
                    <div className="flex items-start gap-2">
                      <FiLink className={`w-5 h-5 mt-0.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                      <div className="flex-1">
                        <p className={`text-xs mb-1 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Share this meeting link</p>
                        <div className={`text-[11px] break-all rounded-md px-2 py-1.5 border ${darkMode ? 'border-gray-800 bg-gray-950 text-gray-200' : 'border-gray-300 bg-gray-50 text-gray-800'}`}>{shareUrl}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl).catch(()=>{})
                          setShowShare(false)
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      >Copy link</button>
                      <button
                        onClick={() => setShowShare(false)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                      >Close</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`w-px h-8 ${darkMode ? 'bg-gray-600' : 'bg-gray-400'}`} />

            {/* Leave Call */}
            <IconBtn onClick={() => setShowEndCallModal(true)} danger label="Leave call">
              <FiPhone className="w-6 h-6" />
            </IconBtn>
          </div>
        </div>
      </div>

      {/* More Options Dropdown - Mobile Only */}
      {showMoreOptions && (
        <div className="fixed inset-0 z-40 md:hidden" data-more-options>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMoreOptions(false)} />
          {/* Panel */}
          <div 
            className={`absolute bottom-24 left-1/2 -translate-x-1/2 w-[min(420px,92%)] sm:w-auto sm:right-8 sm:left-auto sm:translate-x-0 sm:min-w-[280px] rounded-xl shadow-2xl py-2 z-10 transition-all duration-200 origin-bottom ${darkMode ? 'bg-gray-900/95 border border-gray-800 backdrop-blur-md' : 'bg-white/95 border border-gray-200 backdrop-blur-md'}`}
          >
            {/* Screen Share */}
            <button
              onClick={() => {
                setIsScreenSharing(!isScreenSharing)
                setShowMoreOptions(false)
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-colors duration-150 text-left ${darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              <FiMonitor className="w-5 h-5" />
              <span className="text-sm font-medium">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
            </button>

            <div className={`h-px mx-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />

            {/* Show/Hide Participants */}
            <button
              onClick={() => {
                setShowParticipants(!showParticipants)
                setShowMoreOptions(false)
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-colors duration-150 text-left ${darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              <FiUsers className="w-5 h-5" />
              <span className="text-sm font-medium">{showParticipants ? 'Hide Participants' : 'Show Participants'}</span>
            </button>

            <div className={`h-px mx-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />

            {/* Layout Options */}
            <button
              onClick={() => {
                setLayout('sidebar')
                setShowMoreOptions(false)
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 rounded-none transition-colors duration-150 text-left ${layout === 'sidebar' ? (darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600') : (darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900')}`}
            >
              <FiList className="w-5 h-5" />
              <span className="text-sm font-medium">Sidebar Layout</span>
            </button>

            <button
              onClick={() => {
                setLayout('tiled')
                setShowMoreOptions(false)
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 rounded-none transition-colors duration-150 text-left ${layout === 'tiled' ? (darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600') : (darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900')}`}
            >
              <FiGrid className="w-5 h-5" />
              <span className="text-sm font-medium">Grid Layout</span>
            </button>

            <button
              onClick={() => {
                setLayout('spotlight')
                setShowMoreOptions(false)
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 rounded-none transition-colors duration-150 text-left ${layout === 'spotlight' ? (darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600') : (darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900')}`}
            >
              <FiMaximize2 className="w-5 h-5" />
              <span className="text-sm font-medium">Spotlight Layout</span>
            </button>

            <div className={`h-px mx-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />

            {/* Dark/Light Mode */}
            <button
              onClick={() => {
                setDarkMode(!darkMode)
                setShowMoreOptions(false)
              }}
              className={`w-full px-4 py-3 flex items-center transition-colors duration-150  ${darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              {darkMode ? (
                <>
                  <FiSun className="w-5 h-5" />
                  <span className="text-sm font-medium">Light Mode</span>
                </>
              ) : (
                <>
                  <FiMoon className="w-5 h-5" />
                  <span className="text-sm font-medium">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Settings Dropdown - Desktop Only */}
      {showSettings && (
        <div className="fixed inset-0 z-40 hidden md:block" data-settings-dropdown>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm w-full" onClick={() => setShowSettings(false)} />
          <div 
            className={`absolute bottom-28 left-1/2 -translate-x-1/2 min-w-[220px] rounded-xl shadow-2xl py-2 z-10 transition-all duration-200 origin-bottom ${darkMode ? 'bg-gray-900/95 border border-gray-800 backdrop-blur-md' : 'bg-white/95 border border-gray-200 backdrop-blur-md'}`}
          >
            <button
              onClick={() => {
                setDarkMode(!darkMode)
                setShowSettings(false)
              }}
              className={`w-full px-4 py-2 flex items-center justify-center gap-3 transition-colors duration-150 whitespace-nowrap text-center ${darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              {darkMode ? (
                <>
                  <FiSun className="w-5 h-5" />
                  <span className="text-sm font-medium">Light Mode</span>
                </>
              ) : (
                <>
                  <FiMoon className="w-5 h-5" />
                  <span className="text-sm font-medium">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* End Call Confirmation Modal */}
      {showEndCallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-sm transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-lg sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>End call?</h2>
            <p className={`mb-4 sm:mb-6 text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Are you sure you want to leave this meeting? You can rejoin anytime.</p>
            
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowSettings(false)
                  setShowEndCallModal(false)
                }}
                className={`flex-1 px-3 py-2 sm:px-4 sm:py-2 font-semibold rounded-lg transition text-sm sm:text-base ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const meta = (() => { try { return JSON.parse(localStorage.getItem('rc_current_meeting')||'null') } catch { return null } })()
                    const id = meta?.id
                    const isHost = meta?.host
                    if (id) {
                      if (isHost) {
                        await endMeetingApi({ roomId: id })
                      } else {
                        await leaveMeeting({ roomId: id, userId })
                      }
                    }
                  } catch (e) {
                    console.warn('Failed to end meeting', e)
                  } finally {
                    localStorage.removeItem('rc_current_meeting')
                    window.location.href = '/thankyou'
                  }
                }}
                className="flex-1 px-3 py-2 sm:px-4 sm:py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition text-sm sm:text-base"
              >
                End call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Call