import React, { useState, useEffect, useMemo, useRef } from 'react'
import { API_URL, endMeeting as endMeetingApi, joinMeeting, leaveMeeting } from '../utils/api'
import { io, Socket } from 'socket.io-client'
import ParticipantsSidebar from '../components/ParticipantsSidebar'
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhone, FiUsers, FiSettings, FiMoon, FiSun, FiMoreVertical, FiLink } from 'react-icons/fi'

const Call: React.FC = () => {
  const savedMeeting = (() => {
    try { return JSON.parse(localStorage.getItem('rc_current_meeting') || 'null') } catch { return null }
  })()
  const [isMuted, setIsMuted] = useState(!(savedMeeting?.audioOn ?? true))
  const [cameraOff, setCameraOff] = useState(!(savedMeeting?.cameraOn ?? true))
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
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('')
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('')
  const [volume, setVolume] = useState<number>(100)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const peerInfoRef = useRef<Map<string, { userId?: string; name?: string }>>(new Map())
  const peerStreamsRef = useRef<Map<string, MediaStream>>(new Map())

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Debug settings modal state
  useEffect(() => {
    console.log('showSettings changed to:', showSettings)
  }, [showSettings])

  // Debug settings modal state
  useEffect(() => {
    console.log('showSettings changed to:', showSettings)
  }, [showSettings])

  // Load available devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permissions first
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        stream.getTracks().forEach(track => track.stop())
        
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(device => device.kind === 'audioinput')
        const videoInputs = devices.filter(device => device.kind === 'videoinput')
        
        setAudioDevices(audioInputs)
        setVideoDevices(videoInputs)
        
        // Set default devices
        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId)
        }
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId)
        }
      } catch (error) {
        console.error('Error loading devices:', error)
      }
    }

    loadDevices()
  }, [selectedAudioDevice, selectedVideoDevice])

  // Handle device changes
  useEffect(() => {
    if (selectedAudioDevice || selectedVideoDevice) {
      handleDeviceChange()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioDevice, selectedVideoDevice])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      
      // Check if clicked outside settings modal
   
      
      // Check if clicked outside more options dropdown
      if (showMoreOptions && !target.closest('[data-more-options]')) {
        setShowMoreOptions(false)
      }
    }

    // Add event listener
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showSettings, showMoreOptions])

  useEffect(() => {
    // Add scrollbar hiding styles and unlock audio context
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
    
    // Unlock audio context immediately and on user interactions
    const unlockAudio = async () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) {
          console.warn('AudioContext not supported')
          return
        }
        
        const audioContext = new AudioContext()
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
          console.log('Audio context unlocked successfully')
        } else {
          console.log('Audio context already running:', audioContext.state)
        }
        
        // Close the context as we just needed to unlock it
        await audioContext.close()
      } catch (error) {
        console.warn('Audio context unlock failed:', error)
      }
    }
    
    // Try to unlock immediately
    unlockAudio()
    
    // Also unlock on user interactions
    const unlockOnInteraction = () => {
      unlockAudio()
      document.removeEventListener('click', unlockOnInteraction)
      document.removeEventListener('touchstart', unlockOnInteraction)
      document.removeEventListener('keydown', unlockOnInteraction)
    }
    
    document.addEventListener('click', unlockOnInteraction)
    document.addEventListener('touchstart', unlockOnInteraction)
    document.addEventListener('keydown', unlockOnInteraction)
    
    return () => {
      document.head.removeChild(style)
      document.removeEventListener('click', unlockOnInteraction)
      document.removeEventListener('touchstart', unlockOnInteraction)
      document.removeEventListener('keydown', unlockOnInteraction)
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

  // Resolve current user id and name (auth or guest) and persist guest id
  const resolveUserInfo = () => {
    let userId = ''
    let userName = ''
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || 'null')
      // Extract from the correct auth structure
      userId = auth?._id || auth?.user?._id || auth?.userId || auth?.id || ''
      userName = auth?.username || auth?.user?.username || auth?.name || auth?.user?.name || auth?.displayName || ''
      console.log('Auth user info:', { userId, userName, auth })
    } catch {}
    if (!userId) {
      let gid = localStorage.getItem('rc_guest_id')
      if (!gid) {
        gid = `guest_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
        localStorage.setItem('rc_guest_id', gid)
      }
      userId = gid
      // For guests, use saved name or fallback
      userName = localStorage.getItem('rc_name') || 'Guest'
    }
    return { userId, userName }
  }
  const { userId, userName: authUserName } = resolveUserInfo()

  // If no savedMeeting but we have query id, construct a lightweight one (guest)
  useEffect(() => {
    if (!savedMeeting && queryMeetingId) {
      // Prioritize auth name for guest meeting creation
      const guestName = authUserName || localStorage.getItem('rc_name') || 'Guest'
      console.log('Creating guest meeting with name:', guestName, 'from auth:', !!authUserName)
      const fallback = { id: queryMeetingId, host: false, name: guestName, cameraOn: true, audioOn: true, shareUrl }
      localStorage.setItem('rc_current_meeting', JSON.stringify(fallback))
    }
    // Redirect to canonical share link if URL missing m but we have id
    if (savedMeeting && !urlParams.get('m') && savedMeeting.id) {
      window.location.replace(`/call?m=${encodeURIComponent(savedMeeting.id)}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Participants state with proper name tracking
  type ViewParticipant = { id: number; name: string; initials: string; isSpeaking: boolean; isLocal?: boolean; socketId?: string }
  const [participants, setParticipants] = useState<ViewParticipant[]>([])
  const [currentParticipants, setCurrentParticipants] = useState<Array<{socketId: string, userId: string, name: string}>>([])
  type RemotePeer = { socketId: string; userId?: string; name?: string; stream: MediaStream }
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([])

  // Join the room on mount (host or guest) and leave on unmount/navigation
  useEffect(() => {
    if (!queryMeetingId || !userId) return
    let ended = false
    const endedRef = { current: false }

    const doJoin = async () => {
      try {
        // Prioritize auth name, then saved meeting name, then localStorage name, then guest fallback
        const name = (authUserName || savedMeeting?.name || localStorage.getItem('rc_name') || 'Guest').toString()
        console.log('Joining meeting with name:', name, 'from auth:', authUserName)
        const res: any = await joinMeeting({ roomId: queryMeetingId, userId, name })
        
        // Store current participants from server response
        if (res?.participants && Array.isArray(res.participants)) {
          const serverParticipants = res.participants.map((p: any) => ({
            socketId: p.socketId || p.userId || '',
            userId: p.userId || p.id || '',
            name: p.name || 'Unknown User'
          }))
          setCurrentParticipants(serverParticipants)
          
          // Update participants view with proper names
          const localUser: ViewParticipant = {
            id: 0,
            name: name,
            initials: name.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || 'YO',
            isSpeaking: false,
            isLocal: true,
            socketId: 'local'
          }
          
          const mapped: ViewParticipant[] = serverParticipants.map((p: any, idx: number) => {
            const displayName = p.name || p.userId || `User${idx+1}`
            return {
              id: idx + 1,
              name: displayName,
              initials: displayName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase(),
              isSpeaking: false,
              socketId: p.socketId
            }
          })
          
          setParticipants([localUser, ...mapped])
        }
      } catch (e) {
        console.error('Failed to join meeting:', e)
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

  // Prioritize auth name for current user display
  const myName = authUserName || savedMeeting?.name || localStorage.getItem('rc_name') || 'You'
  const myInitials = myName.split(' ').map((s: string) => s[0]).slice(0,2).join('').toUpperCase() || 'YO'
  console.log('Current user display name:', myName, 'from auth:', authUserName)

  // Update participants based on current connections and maintain proper names
  useEffect(() => {
    console.log('=== PARTICIPANT UPDATE ===', {
      remotePeers: remotePeers.map(rp => ({ socketId: rp.socketId, name: rp.name, hasStream: !!rp.stream })),
      currentParticipants: currentParticipants,
      myName,
      myUserId: userId
    })
    
    const localUser: ViewParticipant = {
      id: 0,
      name: myName,
      initials: myInitials,
      isSpeaking: false,
      isLocal: true,
      socketId: 'local'
    }
    
    // Combine remote peers and current participants with proper name resolution
    const allRemoteParticipants = new Map<string, ViewParticipant>()
    
    // Add remote peers (they have streams) with proper names
    remotePeers
      .filter(rp => rp.socketId && rp.socketId.trim() !== '')
      .forEach((rp, idx) => {
        // Get the actual name from multiple sources
        const peerInfo = peerInfoRef.current.get(rp.socketId)
        const displayName = peerInfo?.name || rp.name || rp.userId || 'Remote User'
        
        console.log(`Adding remote peer ${rp.socketId}:`, { 
          name: displayName, 
          peerInfoName: peerInfo?.name,
          rpName: rp.name,
          hasStream: !!rp.stream 
        })
        
        allRemoteParticipants.set(rp.socketId, {
          id: idx + 1,
          name: displayName,
          initials: displayName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase(),
          isSpeaking: false,
          socketId: rp.socketId
        })
      })
    
    // Add current participants that don't have peer connections yet
    currentParticipants
      .filter(cp => cp.socketId && !allRemoteParticipants.has(cp.socketId))
      .forEach((cp) => {
        const displayName = cp.name || cp.userId || 'Connecting User'
        console.log(`Adding current participant ${cp.socketId}:`, { name: displayName })
        
        allRemoteParticipants.set(cp.socketId, {
          id: allRemoteParticipants.size + 1,
          name: displayName,
          initials: displayName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase(),
          isSpeaking: false,
          socketId: cp.socketId
        })
      })
    
    const finalParticipants = [localUser, ...Array.from(allRemoteParticipants.values())]
    console.log('Final participants with socket IDs only:', finalParticipants)
    setParticipants(finalParticipants)
  }, [remotePeers, currentParticipants, myName, myInitials, userId])

  // Update volume of all audio elements when volume changes
  useEffect(() => {
    remotePeers.forEach(rp => {
      const audioElement = document.getElementById(`audio-${rp.socketId}`) as HTMLAudioElement
      if (audioElement) {
        audioElement.volume = volume / 100
        console.log(`Updated volume to ${volume}% for peer ${rp.socketId}`)
      }
    })
  }, [volume, remotePeers])

  // Default open participants sidebar if unauthenticated
  useEffect(() => {
    if (!hasAuth) setShowParticipants(true)
  }, [hasAuth])

  // Debug helper for camera toggle
  const handleDeviceChange = async () => {
    if (!stream || cameraOff) return
    
    console.log('=== DEVICE CHANGE ===', {
      selectedAudioDevice,
      selectedVideoDevice,
      hasStream: !!stream
    })
    
    try {
      // Get new stream with selected devices
      const constraints = {
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Stop old stream
      stream.getTracks().forEach(track => track.stop())
      
      // Apply mute state to new stream
      newStream.getAudioTracks().forEach(track => track.enabled = !isMuted)
      
      // Update stream
      setStream(newStream)
      
      // Update video element
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }
      
    } catch (error) {
      console.error('Error switching devices:', error)
    }
  }

  // Debug helper for camera toggle
  const handleCameraToggle = async () => {
    const newCameraState = !cameraOff
    console.log('=== CAMERA TOGGLE ===', { 
      from: cameraOff ? 'OFF' : 'ON',
      to: newCameraState ? 'OFF' : 'ON',
      hasStream: !!stream,
      streamTracks: stream?.getTracks().length || 0,
      videoElement: !!videoRef.current
    })
    setCameraOff(!cameraOff)
  }

  // Debug stream and camera state changes


  // Camera stream management
  useEffect(() => {
    let isMounted = true
    
    const manageStream = async () => {
      console.log('Managing stream:', { cameraOff, hasStream: !!stream, isMuted })
      
      if (!cameraOff) {
        // Camera should be ON
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ 
            video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true, 
            audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true 
          })
          
          if (isMounted) {
            // Stop old stream if exists
            if (stream) {
              stream.getTracks().forEach(t => t.stop())
            }
            
            // Apply mute state to new stream before setting it
            newStream.getAudioTracks().forEach(t => (t.enabled = !isMuted))
            
            setStream(newStream)
            console.log('Camera turned ON, new stream created')
            
            // Set video element immediately
            if (videoRef.current && isMounted) {
              console.log('Assigning new stream to video element')
              videoRef.current.srcObject = newStream
              videoRef.current.play().catch(console.warn)
            }
          } else {
            newStream.getTracks().forEach(t => t.stop())
          }
        } catch (e) {
          console.error('Camera access failed:', e)
          if (isMounted) {
            setCameraOff(true)
          }
        }
      } else {
        // Camera should be OFF
        if (stream) {
          console.log('Camera turned OFF, stopping stream')
          stream.getTracks().forEach(t => t.stop())
          
          if (isMounted) {
            setStream(null)
            if (videoRef.current) {
              videoRef.current.srcObject = null
            }
          }
        }
      }
    }

    manageStream()
    
    return () => {
      isMounted = false
    }
  }, [cameraOff])

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  // Handle mute changes on existing stream
  useEffect(() => {
    if (stream && !cameraOff) {
      stream.getAudioTracks().forEach(t => (t.enabled = !isMuted))
      console.log('Audio mute changed:', !isMuted)
    }
  }, [isMuted, stream, cameraOff])

  // Assign stream to video element when available
  useEffect(() => {
    if (videoRef.current) {
      if (stream && !cameraOff) {
        console.log('Assigning stream to video element via useEffect')
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(console.warn)
      } else {
        console.log('Clearing video element via useEffect')
        videoRef.current.srcObject = null
      }
    }
  }, [stream, cameraOff])

  // Socket.IO + WebRTC mesh connections
  useEffect(() => {
    if (!queryMeetingId) return
    const SOCKET_URL = API_URL.replace(/\/api\/v1$/, '')
    const socket = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'], 
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
    socketRef.current = socket

    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
      ],
    }

    const addLocalTracks = (pc: RTCPeerConnection) => {
      if (!stream) {
        console.log('No local stream to add to peer connection')
        return
      }
      try {
        console.log('Adding local tracks to peer connection:', stream.getTracks().length, 'tracks')
        stream.getTracks().forEach(track => {
          try {
            // Check if track is already added
            const existingSender = pc.getSenders().find(sender => sender.track === track)
            if (!existingSender) {
              console.log('Adding track:', track.kind, track.id)
              pc.addTrack(track, stream)
            } else {
              console.log('Track already exists:', track.kind, track.id)
            }
          } catch (e) {
            console.warn('Failed to add track:', e)
          }
        })
      } catch (e) {
        console.warn('Failed to add local tracks:', e)
      }
    }

    const removeLocalTracks = (pc: RTCPeerConnection) => {
      try {
        pc.getSenders().forEach(sender => {
          if (sender.track) {
            try {
              pc.removeTrack(sender)
            } catch (e) {
              console.warn('Failed to remove track:', e)
            }
          }
        })
      } catch (e) {
        console.warn('Failed to remove local tracks:', e)
      }
    }

    const cleanupPeer = (sid: string) => {
      const pc = peersRef.current.get(sid)
      if (pc) {
        try { 
          pc.onicecandidate = null
          pc.ontrack = null
          pc.onconnectionstatechange = null
        } catch {}
        try { 
          removeLocalTracks(pc)
        } catch {}
        try { 
          pc.close() 
        } catch {}
      }
      
      // Cleanup audio element
      const audioElement = document.getElementById(`audio-${sid}`) as HTMLAudioElement
      if (audioElement) {
        try {
          audioElement.pause()
          audioElement.srcObject = null
          audioElement.remove()
          console.log(`Removed audio element for ${sid}`)
        } catch (error) {
          console.warn(`Failed to cleanup audio element for ${sid}:`, error)
        }
      }
      
      peersRef.current.delete(sid)
      peerInfoRef.current.delete(sid)
      peerStreamsRef.current.delete(sid)
      setRemotePeers(prev => prev.filter(p => p.socketId !== sid))
    }

    const createPeer = async (targetSocketId: string, initiator: boolean, meta?: { userId?: string; name?: string }) => {
      if (peersRef.current.has(targetSocketId)) {
        console.log(`Peer connection already exists for ${targetSocketId}`)
        return peersRef.current.get(targetSocketId)!
      }
      
      console.log(`Creating peer connection for ${targetSocketId}, initiator: ${initiator}`, meta)
      const pc = new RTCPeerConnection(rtcConfig)
      peersRef.current.set(targetSocketId, pc)
      if (meta) peerInfoRef.current.set(targetSocketId, meta)
      
      // Add local tracks if we have them
      addLocalTracks(pc)

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          console.log(`Sending ICE candidate to ${targetSocketId}`)
          socket.emit('signal', { to: targetSocketId, data: { type: 'candidate', candidate: ev.candidate } })
        }
      }
      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams
        if (!remoteStream) {
          console.log(`No remote stream received for ${targetSocketId}`)
          return
        }
        console.log(`Remote stream received for ${targetSocketId}:`, { 
          streamId: remoteStream.id, 
          tracks: remoteStream.getTracks().length,
          audioTracks: remoteStream.getAudioTracks().length,
          videoTracks: remoteStream.getVideoTracks().length
        })
        
        // Ensure all audio tracks are enabled and unmuted
        remoteStream.getAudioTracks().forEach((track, index) => {
          track.enabled = true
          console.log(`Audio track ${index} for ${targetSocketId}:`, {
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted,
            id: track.id
          })
        })
        
        // Create dedicated audio element for this peer
        const audioElement = document.createElement('audio')
        audioElement.srcObject = remoteStream
        audioElement.autoplay = true
        audioElement.muted = false
        audioElement.volume = volume / 100 // Apply volume setting
        audioElement.id = `audio-${targetSocketId}`
        
        // Add to DOM (hidden) for audio playback
        audioElement.style.display = 'none'
        document.body.appendChild(audioElement)
        
        // Play audio with user gesture unlock
        const playAudio = async () => {
          try {
            await audioElement.play()
            console.log(`Audio playing for ${targetSocketId}`)
          } catch (error) {
            console.warn(`Audio play failed for ${targetSocketId}:`, error)
            // Try to unlock audio context and retry
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
              if (audioContext.state === 'suspended') {
                await audioContext.resume()
                console.log('Audio context resumed, retrying audio play')
                await audioElement.play()
              }
            } catch (retryError) {
              console.warn(`Audio retry failed for ${targetSocketId}:`, retryError)
            }
          }
        }
        
        playAudio()
        
        peerStreamsRef.current.set(targetSocketId, remoteStream)
        const info = peerInfoRef.current.get(targetSocketId)
        
        setRemotePeers(prev => {
          const existing = prev.find(p => p.socketId === targetSocketId)
          if (existing) {
            console.log(`Updating existing peer ${targetSocketId} with new stream and name:`, info?.name)
            return prev.map(p => p.socketId === targetSocketId ? { 
              ...p, 
              stream: remoteStream,
              name: info?.name || p.name || p.userId || 'Remote User',
              userId: info?.userId || p.userId
            } : p)
          }
          console.log(`Adding new remote peer ${targetSocketId}:`, { userId: info?.userId, name: info?.name })
          return [...prev, { 
            socketId: targetSocketId, 
            userId: info?.userId, 
            name: info?.name || 'Remote User', 
            stream: remoteStream 
          }]
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
      console.log('=== SOCKET CONNECTED ===', {
        socketId: socket.id,
        userId,
        myName,
        authUserName,
        roomId: queryMeetingId
      })
      // Use authenticated user name for socket connection
      const name = (authUserName || savedMeeting?.name || localStorage.getItem('rc_name') || 'Guest').toString()
      console.log('Joining room with auth name:', { roomId: queryMeetingId, userId, name, fromAuth: !!authUserName })
      socket.emit('join-room', { roomId: queryMeetingId, userId, name })
    })
    
    socket.on('disconnect', (reason) => {
      console.log('=== SOCKET DISCONNECTED ===', { reason, socketId: socket.id })
    })
    
    socket.on('reconnect', () => {
      console.log('=== SOCKET RECONNECTED ===', { socketId: socket.id, authUserName })
      // Use authenticated user name for reconnection
      const name = (authUserName || savedMeeting?.name || localStorage.getItem('rc_name') || 'Guest').toString()
      console.log('Reconnecting with auth name:', name, 'from auth:', !!authUserName)
      socket.emit('join-room', { roomId: queryMeetingId, userId, name })
    })
    
    socket.on('room-joined', ({ participants: roomParticipants }: { participants?: any[] }) => {
      console.log('=== ROOM JOINED ===', { roomParticipants })
      if (roomParticipants && Array.isArray(roomParticipants)) {
        const serverParticipants = roomParticipants
          .filter(p => p.userId !== userId) // Exclude self
          .map((p: any) => ({
            socketId: p.socketId || p.userId || '',
            userId: p.userId || p.id || '',
            name: p.name || 'Unknown User'
          }))
        console.log('Setting existing participants:', serverParticipants)
        setCurrentParticipants(serverParticipants)
      }
    })
    socket.on('user-joined', ({ userId: uid, name: uname, socketId }: { userId?: string; name?: string; socketId: string }) => {
      console.log('=== USER JOINED ===', { socketId, userId: uid, name: uname, myUserId: userId })
      
      // Don't add ourselves
      if (uid === userId) {
        console.log('Ignoring self join event')
        return
      }
      
      peerInfoRef.current.set(socketId, { userId: uid, name: uname })
      
      // Add to current participants list
      setCurrentParticipants(prev => {
        const existing = prev.find(p => p.socketId === socketId || p.userId === uid)
        if (existing) {
          console.log('User already exists in participants:', existing)
          return prev
        }
        const newParticipant = { socketId, userId: uid || '', name: uname || 'Unknown User' }
        console.log('Adding new participant:', newParticipant)
        return [...prev, newParticipant]
      })
      
      createPeer(socketId, true, { userId: uid, name: uname })
    })
    socket.on('signal', handleSignal)
    socket.on('user-left', ({ socketId, userId: leftUserId }: { socketId?: string; userId?: string }) => {
      console.log('=== USER LEFT ===', { socketId, userId: leftUserId })
      
      // Remove from current participants by both socketId and userId
      setCurrentParticipants(prev => {
        const filtered = prev.filter(p => {
          const matchSocket = socketId && p.socketId === socketId
          const matchUser = leftUserId && p.userId === leftUserId
          return !(matchSocket || matchUser)
        })
        console.log('Remaining participants after leave:', filtered)
        return filtered
      })
      
      // Clean up peer connection
      if (socketId) {
        cleanupPeer(socketId)
      }
    })
    socket.on('meeting-ended', () => {
      try { peersRef.current.forEach((_, sid) => cleanupPeer(sid)) } finally { window.location.href = '/thankyou' }
    })

    return () => {
      console.log('=== CLEANING UP SOCKET ===', { queryMeetingId, userId })
      try { socket.emit('leave-room', { roomId: queryMeetingId, userId }) } catch {}
      try { socket.off('user-joined'); socket.off('signal'); socket.off('user-left'); socket.off('meeting-ended'); socket.off('room-joined'); socket.off('disconnect'); socket.off('reconnect'); socket.disconnect() } catch {}
      peersRef.current.forEach((_, sid) => cleanupPeer(sid))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryMeetingId, userId, stream])

  // Update peer connections when stream changes (camera toggle)
  useEffect(() => {
    if (socketRef.current?.connected) {
      // Update all existing peer connections with new stream state
      peersRef.current.forEach((pc) => {
        try {
          // Remove all existing tracks first
          pc.getSenders().forEach(sender => {
            if (sender.track) {
              try {
                pc.removeTrack(sender)
              } catch (e) {
                console.warn('Failed to remove track:', e)
              }
            }
          })
          
          // Add new tracks if stream exists and camera is on
          if (stream && !cameraOff) {
            stream.getTracks().forEach(track => {
              try {
                pc.addTrack(track, stream)
              } catch (e) {
                console.warn('Failed to add track:', e)
              }
            })
          }
        } catch (e) {
          console.warn('Failed to update peer tracks:', e)
        }
      })
    }
  }, [stream])

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
      <button aria-label={label} title={label} className={`${base} ${schemes} ${className} cursor-pointer`} {...props}>
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
          {showParticipants ? 'Hide' : 'Show'} participants · {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </button>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 p-2 sm:p-4 transition-colors duration-200 overflow-hidden ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
          <div className="h-full overflow-hidden">
            <div className={`grid gap-2 sm:gap-4 h-full overflow-hidden ${showParticipants ? 'grid-cols-1 lg:grid-cols-4' : 'grid-cols-1'}`}>
              {/* Main Video */}
              <div className={`${showParticipants ? 'lg:col-span-3' : 'col-span-1'} rounded-xl sm:rounded-2xl overflow-hidden shadow-lg relative group transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <div className="w-full h-full bg-linear-to-br from-green-600 to-green-800 flex items-center justify-center relative overflow-hidden">
                  {stream && !cameraOff ? (
                    <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
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
                    {remotePeers
                      .filter(rp => rp.stream && rp.stream.getTracks().length > 0)
                      .map((rp) => {
                        // Get the actual name from peerInfo or use fallback
                        const peerInfo = peerInfoRef.current.get(rp.socketId)
                        const participantName = peerInfo?.name || rp.name || rp.userId || 'Remote User'
                        
                        console.log(`Rendering remote peer ${rp.socketId}:`, { 
                          name: participantName,
                          peerInfoName: peerInfo?.name,
                          rpName: rp.name,
                          hasStream: !!rp.stream,
                          tracks: rp.stream?.getTracks().length || 0,
                          videoTracks: rp.stream?.getVideoTracks().length || 0,
                          audioTracks: rp.stream?.getAudioTracks().length || 0
                        })
                        
                        return (
                          <div key={rp.socketId} className={`relative w-40 h-24 rounded-md overflow-hidden ${darkMode ? 'bg-gray-900/40' : 'bg-gray-200/60'}`}>
                            <video 
                              autoPlay 
                              playsInline
                              muted={false}
                              controls={false}
                              className="w-full h-full object-cover" 
                              onLoadedData={() => console.log(`Video loaded for ${participantName}`)}
                              onError={(e) => console.error(`Video error for ${participantName}:`, e)}
                              onCanPlay={() => {
                                console.log(`Video can play for ${participantName}`)
                                // Ensure audio is enabled
                                if (rp.stream) {
                                  rp.stream.getAudioTracks().forEach(track => {
                                    console.log(`Audio track for ${participantName}:`, {
                                      enabled: track.enabled,
                                      readyState: track.readyState,
                                      muted: track.muted
                                    })
                                  })
                                }
                              }}
                              ref={(el) => {
                                if (el && rp.stream) {
                                  console.log(`Assigning stream to video element for ${participantName}`, {
                                    streamId: rp.stream.id,
                                    tracks: rp.stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
                                  })
                                  ;(el as any).srcObject = rp.stream
                                  
                                  // Configure audio properly
                                  el.volume = volume / 100 // Apply volume setting
                                  el.muted = false
                                  
                                  // Ensure audio tracks are enabled
                                  rp.stream.getAudioTracks().forEach(track => {
                                    track.enabled = true
                                    console.log(`Video element - enabled audio track for ${participantName}:`, track.enabled)
                                  })
                                  
                                  // Ensure video plays
                                  el.play().catch(e => {
                                    console.warn(`Failed to play video for ${participantName}:`, e)
                                  })
                                }
                              }} 
                            />
                            <div className={`absolute bottom-0 left-0 right-0 text-[10px] px-1 py-0.5 truncate ${darkMode ? 'bg-black/40 text-white' : 'bg-white/60 text-gray-900'}`}>
                              {participantName}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Participants Sidebar - Conditional */}
              {showParticipants && (
                <div className="lg:col-span-1 overflow-y-auto overflow-x-hidden pr-0 sm:pr-2 scrollbar-hide">
                  <ParticipantsSidebar participants={participants} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Participants Sidebar - Conditional for larger screens */}
        {showParticipants && (
          <div className={`hidden lg:block w-80 border-l overflow-y-auto overflow-x-hidden p-4 scrollbar-hide ${darkMode ? 'border-gray-800 bg-gray-900/70' : 'border-gray-200 bg-white/70'}`}>
            <ParticipantsSidebar participants={participants} />
          </div>
        )}
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
            <IconBtn onClick={handleCameraToggle} danger={cameraOff} label={cameraOff ? 'Turn on camera' : 'Turn off camera'}>
              {cameraOff ? <FiVideoOff className="w-6 h-6" /> : <FiVideo className="w-6 h-6" />}
            </IconBtn>

            {/* More Options (3 dots) */}
            <div className="relative" data-more-options>
              <IconBtn onClick={() =>setShowSettings(true)} label="More options">
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
              <IconBtn onClick={handleCameraToggle} danger={cameraOff} label={cameraOff ? 'Turn on camera' : 'Turn off camera'}>
                {cameraOff ? <FiVideoOff className="w-6 h-6" /> : <FiVideo className="w-6 h-6" />}
              </IconBtn>
            </div>

            <div className={`w-px h-8 ${darkMode ? 'bg-gray-600' : 'bg-gray-400'}`} />

            {/* Secondary Controls */}
            <div className="flex items-center gap-2">
              {/* Show/Hide Participants */}
              <IconBtn onClick={() => setShowParticipants(!showParticipants)} active={showParticipants} label={showParticipants ? 'Hide participants' : 'Show participants'}>
                <FiUsers className="w-6 h-6" />
              </IconBtn>
            </div>

            <div className={`w-px h-8 ${darkMode ? 'bg-gray-600' : 'bg-gray-400'}`} />

            {/* Settings */}
            <div className="relative cursor-pointer" data-settings-button>
              <IconBtn onClick={() => {
                console.log("Settings",showSettings)
                setShowSettings(true);
              }}  label="Settings">
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
        <div className="fixed inset-0 z-30 md:hidden" data-more-options>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMoreOptions(false)} />
          {/* Panel */}
          <div 
            className={`absolute bottom-24 left-1/2 -translate-x-1/2 w-[min(420px,92%)] max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl py-3 z-10 transition-all duration-200 origin-bottom ${darkMode ? 'bg-gray-900/95 border border-gray-800 backdrop-blur-md' : 'bg-white/95 border border-gray-200 backdrop-blur-md'}`}
          >
            {/* Header */}
            <div className={`px-4 py-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Meeting Options</h3>
            </div>

            {/* Media Controls */}
            <div className="px-4 py-3">
              <label className={`text-xs font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Media Controls</label>
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => {
                    setIsMuted(!isMuted)
                    setShowMoreOptions(false)
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${isMuted ? (darkMode ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400' : 'bg-red-50 hover:bg-red-100 text-red-600') : (darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}`}
                >
                  <div className="flex items-center gap-3">
                    {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                    <span className="text-sm font-medium">Microphone</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${isMuted ? (darkMode ? 'bg-red-600/30 text-red-300' : 'bg-red-100 text-red-700') : (darkMode ? 'bg-green-600/30 text-green-300' : 'bg-green-100 text-green-700')}`}>
                    {isMuted ? 'Off' : 'On'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    handleCameraToggle()
                    setShowMoreOptions(false)
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${cameraOff ? (darkMode ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400' : 'bg-red-50 hover:bg-red-100 text-red-600') : (darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}`}
                >
                  <div className="flex items-center gap-3">
                    {cameraOff ? <FiVideoOff className="w-5 h-5" /> : <FiVideo className="w-5 h-5" />}
                    <span className="text-sm font-medium">Camera</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${cameraOff ? (darkMode ? 'bg-red-600/30 text-red-300' : 'bg-red-100 text-red-700') : (darkMode ? 'bg-green-600/30 text-green-300' : 'bg-green-100 text-green-700')}`}>
                    {cameraOff ? 'Off' : 'On'}
                  </span>
                </button>
              </div>
            </div>



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

            {/* Settings */}
            <button
              onClick={() => {
                console.log('Settings button clicked on mobile')
                setShowMoreOptions(false) // Close dropdown first
                setTimeout(() => {
                  console.log('Opening settings modal')
                  setShowSettings(true)
                }, 100) // Small delay to ensure dropdown closes first
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-colors duration-150 text-left ${darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              <FiSettings className="w-5 h-5" />
              <span className="text-sm font-medium">Settings</span>
            </button>

            {/* Share Link (Mobile) */}
            {shareUrl && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    console.log('Meeting link copied to clipboard')
                    setShowMoreOptions(false)
                  }).catch(() => {
                    console.warn('Failed to copy meeting link')
                    setShowMoreOptions(false)
                  })
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors duration-150 text-left ${darkMode ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}`}
              >
                <FiLink className="w-5 h-5" />
                <span className="text-sm font-medium">Copy Meeting Link</span>
              </button>
            )}



            {/* Appearance */}
            <div className="px-4 py-3">
              <label className={`text-xs font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Appearance</label>
              <button
                onClick={() => {
                  setDarkMode(!darkMode)
                  setShowMoreOptions(false)
                }}
                className={`w-full px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <div className="flex items-center gap-3">
                  {darkMode ? <FiMoon className="w-5 h-5" /> : <FiSun className="w-5 h-5" />}
                  <span className="text-sm font-medium">Theme</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-blue-600/30 text-blue-300' : 'bg-yellow-100 text-yellow-700'}`}>
                  {darkMode ? 'Dark' : 'Light'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-2 sm:p-4"
          style={{ display: 'flex', visibility: 'visible', position: 'fixed' }}
          onClick={(e) => {
            console.log('Settings modal backdrop clicked')
            if (e.target === e.currentTarget) {
              setShowSettings(true)
            }
          }}
        >
          <div 
            className={`rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-lg max-h-[90vh] sm:max-h-[90vh] overflow-y-auto transition-colors duration-200 mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`} 
            style={{ display: 'block', visibility: 'visible', position: 'relative' }}
            data-settings-modal
          >
            {/* Header */}
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg sm:text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className={`p-2 sm:p-1 rounded-lg transition-colors touch-manipulation ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
              {/* Video Preview */}
              <div>
                <label className={`text-sm font-medium mb-3 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Video Preview</label>
                <div className={`relative rounded-xl overflow-hidden aspect-video max-w-sm mx-auto ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  {stream && !cameraOff ? (
                    <video 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el && stream) {
                          el.srcObject = stream
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center mb-2">
                        <span className="text-lg font-bold text-white">{myInitials}</span>
                      </div>
                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Camera off</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Audio Settings */}
              <div>
                <label className={`text-sm font-medium mb-3 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Audio</label>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      {isMuted ? <FiMicOff className="w-5 h-5 text-red-500" /> : <FiMic className="w-5 h-5 text-green-500" />}
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Microphone</span>
                    </div>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${isMuted ? 'bg-red-600' : 'bg-green-600'} ${darkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMuted ? 'translate-x-1' : 'translate-x-6'}`} />
                    </button>
                  </div>

                  {/* Microphone Device Selection */}
                  {audioDevices.length > 0 && (
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <label className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Microphone Device</label>
                      <select
                        value={selectedAudioDevice || ''}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors ${
                          darkMode 
                            ? 'bg-gray-600 border-gray-500 text-gray-200 focus:border-green-500' 
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                      >
                        {audioDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Settings */}
              <div>
                <label className={`text-sm font-medium mb-3 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Video</label>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      {cameraOff ? <FiVideoOff className="w-5 h-5 text-red-500" /> : <FiVideo className="w-5 h-5 text-green-500" />}
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Camera</span>
                    </div>
                    <button
                      onClick={handleCameraToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${cameraOff ? 'bg-red-600' : 'bg-green-600'} ${darkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cameraOff ? 'translate-x-1' : 'translate-x-6'}`} />
                    </button>
                  </div>

                  {/* Camera Device Selection */}
                  {videoDevices.length > 0 && (
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <label className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Camera Device</label>
                      <select
                        value={selectedVideoDevice || ''}
                        onChange={(e) => setSelectedVideoDevice(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors ${
                          darkMode 
                            ? 'bg-gray-600 border-gray-500 text-gray-200 focus:border-green-500' 
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:outline-none focus:ring-2 focus:ring-green-500/20`}
                      >
                        {videoDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Appearance Settings */}
              <div>
                <label className={`text-sm font-medium mb-3 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Volume Control</label>
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <label className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Remote Audio Volume</label>
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L4.5 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.5l3.883-3.32a1 1 0 011.617.82zM6 8.98L8 7.5v5l-2-1.48H3v-3h3.02zM13 8a1 1 0 011.414 0L15.5 9.086 16.586 8A1 1 0 0118 9.414l-1.086 1.086L18 11.586A1 1 0 0116.586 13L15.5 11.914 14.414 13A1 1 0 0113 11.586l1.086-1.086L13 9.414A1 1 0 0113 8z" clipRule="evenodd" /></svg>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className={`flex-1 h-3 sm:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${volume}%, ${darkMode ? '#374151' : '#e5e7eb'} ${volume}%, ${darkMode ? '#374151' : '#e5e7eb'} 100%)`
                        }}
                      />
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v1.323l3.954 1.582 1.599-.8A1 1 0 0118 7v6a1 1 0 01-1.447.894l-1.599-.8L11 14.677V16a1 1 0 11-2 0v-1.323l-3.954-1.582-1.599.8A1 1 0 012 13V7a1 1 0 011.447-.894l1.599.8L9 8.323V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Muted</span>
                      <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{volume}%</span>
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Loud</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appearance Settings */}
              <div>
                <label className={`text-sm font-medium mb-3 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Appearance</label>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      {darkMode ? <FiMoon className="w-5 h-5" /> : <FiSun className="w-5 h-5" />}
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Dark Mode</span>
                    </div>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${darkMode ? 'bg-blue-600' : 'bg-gray-400'} ${darkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowSettings(false)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Call Confirmation Modal */}
      {showEndCallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className={`rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-sm transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-lg sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>End call?</h2>
            <p className={`mb-4 sm:mb-6 text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Are you sure you want to leave this meeting? You can rejoin anytime.</p>
            
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => {
                  // setShowSettings(false)
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