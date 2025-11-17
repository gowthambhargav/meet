import React, { useEffect, useMemo, useState } from 'react'
import { createMeeting } from '../utils/api'
import { 
  FiCalendar, FiClock, FiCopy, FiHash, FiLink, FiLogOut, 
  FiPlay, FiPlus, FiTrash2, FiUsers, FiX
} from 'react-icons/fi'
 

type Meeting = {
  id: string
  title: string
  description?: string
  startAt: string // ISO string
  durationMins: number
  link: string
  createdAt: string
}

const storageKey = 'rc_meetings'

const Dashboard: React.FC = () => {
  const [darkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showHostJoin, setShowHostJoin] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [hostName, setHostName] = useState<string>(() => {
    try { const a = JSON.parse(localStorage.getItem('auth')||'null'); return a?.user?.username || '' } catch { return '' }
  })
  const [hostCameraOn, setHostCameraOn] = useState(true)
  const [hostAudioOn, setHostAudioOn] = useState(true)
  const [pendingMeetingId, setPendingMeetingId] = useState<string | null>(null)

  // Schedule form state
  const now = useMemo(() => new Date(), [])
  const pad = (n: number) => n.toString().padStart(2, '0')
  const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const [title, setTitle] = useState('Team Sync')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultTime)
  const [durationMins, setDurationMins] = useState(30)
  const [desc, setDesc] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]') as Meeting[]
      setMeetings(saved)
    } catch {
      setMeetings([])
    }
  }, [])

  // Redirect to home if not authenticated
  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || 'null')
      if (!auth) {
        window.location.href = '/'
      }
    } catch {
      window.location.href = '/'
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(meetings))
  }, [meetings])

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d)
  }

  const genId = () => `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const makeLink = (id: string) => `${window.location.origin}/call?m=${id}`

  const createInstant = () => {
    const id = genId()
    setPendingMeetingId(id)
    setShowHostJoin(true)
  }

  const scheduleMeeting = () => {
    // Construct ISO from date and time (local time)
    const [hh, mm] = time.split(':').map(Number)
    const [y, mon, d] = date.split('-').map(Number)
    const local = new Date(y, (mon || 1) - 1, d || 1, hh || 0, mm || 0)
    if (isNaN(local.getTime())) {
      alert('Please enter a valid date and time')
      return
    }
    const id = genId()
    const m: Meeting = {
      id,
      title: title.trim() || 'Scheduled Meeting',
      description: desc.trim() || undefined,
      startAt: local.toISOString(),
      durationMins: Math.max(15, Math.min(480, Number(durationMins) || 30)),
      link: makeLink(id),
      createdAt: new Date().toISOString(),
    }
    setMeetings(prev => [m, ...prev])
    setShowSchedule(false)
  }

  const removeMeeting = (id: string) => {
    if (!confirm('Delete this meeting?')) return
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  const copy = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id || null)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedId(id || null)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  const upcoming = useMemo(() => {
    const now = Date.now()
    return [...meetings].sort((a,b) => +new Date(a.startAt) - +new Date(b.startAt))
      .filter(m => +new Date(m.startAt) >= now - 24*3600*1000) // include last 24h
  }, [meetings])

  const headerBg = darkMode ? 'bg-gray-900/70 border-gray-800' : 'bg-white/70 border-gray-200'
  const pageBg = darkMode ? 'bg-gray-950' : 'bg-gray-50'
  const textPri = darkMode ? 'text-white' : 'text-gray-900'
  const textSec = darkMode ? 'text-gray-300' : 'text-gray-600'

  return (
    <div className={`min-h-screen ${pageBg} transition-colors`}>
      {/* Top bar */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${headerBg}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-r from-green-600 to-emerald-600" />
            <h1 className={`font-semibold text-lg ${textPri}`}>RuralCall</h1>
          </div>
          <button
            onClick={() => {
              // Simple logout placeholder
              localStorage.removeItem('auth')
              window.location.href = '/login'
            }}
            className={`p-2 rounded-lg transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
            title="Logout"
          >
            <FiLogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Actions */}
        <section className={`rounded-2xl border overflow-hidden mb-8 ${darkMode ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'} relative`}> 
          <div className="p-5 sm:p-8">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className={`text-xl sm:text-2xl font-bold ${textPri}`}>Welcome back</h2>
                <p className={`${textSec} mt-1`}>Create, schedule, or join meetings in seconds.</p>
              </div>
              
              {/* Action buttons - responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={createInstant} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold shadow-sm transition ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                  <FiPlay className="w-5 h-5"/> Start now
                </button>
                <button onClick={() => setShowSchedule(true)} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold shadow-sm transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 hover:bg-black text-white'}`}>
                  <FiPlus className="w-5 h-5"/> Schedule
                </button>
                <button onClick={() => setShowJoin(true)} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold shadow-sm transition ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                  <FiHash className="w-5 h-5"/> Join
                </button>
              </div>
            </div>
          </div>
          {/* Decorative gradient */}
          <div className="absolute inset-x-0 -bottom-20 h-40 pointer-events-none bg-linear-to-r from-green-600/10 via-emerald-500/10 to-sky-500/10 blur-2xl"/>
        </section>

        {/* Upcoming meetings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-lg font-semibold ${textPri}`}>Upcoming</h3>
            <button onClick={() => setShowSchedule(true)} className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${darkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              <FiCalendar className="w-4 h-4"/> New meeting
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className={`rounded-xl border p-6 text-center ${darkMode ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
              <p className={`${textSec}`}>No upcoming meetings. Schedule your next one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(m => (
                <div key={m.id} className={`rounded-xl border p-4 flex flex-col gap-3 transition hover:shadow-md ${darkMode ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={`font-semibold ${textPri}`}>{m.title}</h4>
                      <div className={`mt-1 text-sm flex items-center gap-3 ${textSec}`}>
                        <span className="inline-flex items-center gap-1"><FiCalendar className="w-4 h-4"/>{fmt(m.startAt)}</span>
                        <span className="inline-flex items-center gap-1"><FiClock className="w-4 h-4"/>{m.durationMins}m</span>
                      </div>
                    </div>
                    <button onClick={() => removeMeeting(m.id)} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title="Delete">
                      <FiTrash2 className="w-5 h-5"/>
                    </button>
                  </div>

                  {m.description && (
                    <p className={`text-sm ${textSec}`}>{m.description}</p>
                  )}

                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${darkMode ? 'border-gray-800 bg-gray-950/60 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                    <FiLink className="w-4 h-4"/>
                    <span className="truncate text-xs sm:text-sm">{m.link}</span>
                    <button onClick={() => copy(m.link, m.id)} className={`ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 hover:bg-black text-white'}`}>
                      <FiCopy className="w-3.5 h-3.5"/>{copiedId === m.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => (window.location.href = '/call')} className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                      <FiPlay className="w-4 h-4"/> Join
                    </button>
                    <button onClick={() => copy(m.link, m.id)} className={`px-3 py-2 rounded-lg font-medium inline-flex items-center gap-2 transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
                      <FiCopy className="w-4 h-4"/> Copy link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Schedule modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSchedule(false)} />
          <div className="absolute inset-0 flex items-end sm:items-center justify-center">
            <div className={`w-full sm:w-[min(560px,92%)] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="p-5 sm:p-6 border-b flex items-center justify-between gap-3 sticky top-0 bg-inherit z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-r from-green-600 to-emerald-600" />
                  <h4 className={`font-semibold ${textPri}`}>Schedule a meeting</h4>
                </div>
                <button onClick={() => setShowSchedule(false)} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <FiX className="w-5 h-5"/>
                </button>
              </div>

              <div className="p-4 sm:p-6 grid gap-4">
                <div className="grid gap-2">
                  <label className={`text-sm font-medium ${textSec}`}>Title</label>
                  <input value={title} onChange={e=>setTitle(e.target.value)} className={`px-3 py-2.5 rounded-lg border outline-none text-base ${darkMode ? 'bg-gray-950 border-gray-800 text-white placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'}`} placeholder="Team Sync" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <label className={`text-sm font-medium ${textSec}`}>Date</label>
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={`px-3 py-2.5 rounded-lg border outline-none w-full text-base ${darkMode ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                  </div>
                  <div className="grid gap-2">
                    <label className={`text-sm font-medium ${textSec}`}>Time</label>
                    <input type="time" value={time} onChange={e=>setTime(e.target.value)} className={`px-3 py-2.5 rounded-lg border outline-none w-full text-base ${darkMode ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className={`text-sm font-medium ${textSec}`}>Duration (minutes)</label>
                  <input type="number" min={15} max={480} step={15} value={durationMins} onChange={e=>setDurationMins(Number(e.target.value))} className={`px-3 py-2.5 rounded-lg border outline-none w-full text-base ${darkMode ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                </div>

                <div className="grid gap-2">
                  <label className={`text-sm font-medium ${textSec}`}>Description (optional)</label>
                  <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} className={`px-3 py-2.5 rounded-lg border outline-none resize-y text-base ${darkMode ? 'bg-gray-950 border-gray-800 text-white placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'}`} placeholder="Agenda or notes" />
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <div className={`text-xs sm:text-sm ${textSec} inline-flex items-center gap-2`}>
                    <FiUsers className="w-4 h-4"/> Invite later by sharing the link
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowSchedule(false)} className={`px-4 py-2.5 rounded-lg font-medium transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>Cancel</button>
                    <button onClick={scheduleMeeting} className={`px-4 py-2.5 rounded-lg font-semibold transition ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>Create</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join modal - mobile friendly */}
      {showJoin && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowJoin(false)} />
          <div className="absolute inset-0 flex items-end sm:items-center justify-center">
            <div className={`w-full sm:w-[min(480px,92%)] rounded-t-2xl sm:rounded-2xl border shadow-2xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="p-5 sm:p-6 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-r from-green-600 to-emerald-600" />
                  <h4 className={`font-semibold ${textPri}`}>Join a meeting</h4>
                </div>
                <button onClick={() => setShowJoin(false)} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <FiX className="w-5 h-5"/>
                </button>
              </div>
              <div className="p-5 sm:p-6 grid gap-4">
                <div className={`flex items-center rounded-xl px-3 py-2 border ${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <FiLink className={`${textSec} w-5 h-5 mr-2`} />
                  <input value={joinInput} onChange={e=>setJoinInput(e.target.value)} className={`flex-1 bg-transparent outline-none text-sm ${textPri} placeholder:${textSec}`}
                         placeholder="Enter code or link" />
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setShowJoin(false)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>Cancel</button>
                  <button onClick={() => { if (!joinInput.trim()) { alert('Enter a code or link'); return; } window.location.href = '/call'; }} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold transition ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Join</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Host Join modal (Start now flow) */}
      {showHostJoin && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHostJoin(false)} />
          <div className="absolute inset-0 flex items-end sm:items-center justify-center">
            <div className={`w-full sm:w-[min(520px,92%)] rounded-t-2xl sm:rounded-2xl border shadow-2xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="p-5 sm:p-6 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-r from-green-600 to-emerald-600" />
                  <h4 className={`font-semibold ${textPri}`}>Start a meeting</h4>
                </div>
                <button onClick={() => setShowHostJoin(false)} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <FiX className="w-5 h-5"/>
                </button>
              </div>
              <div className="p-5 sm:p-6 grid gap-4">
                <div className="grid gap-1.5">
                  <label className={`text-sm ${textSec}`}>Meeting code</label>
                  <div className={`px-3 py-2 rounded-lg border font-mono text-sm ${darkMode ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}>{pendingMeetingId}</div>
                </div>
                <div className="grid gap-1.5">
                  <label className={`text-sm ${textSec}`}>Your name</label>
                  <input value={hostName} onChange={e=>setHostName(e.target.value)} className={`px-3 py-2 rounded-lg border outline-none ${darkMode ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Your display name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer ${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <span className={`${textPri} text-sm font-medium`}>Camera</span>
                    <button type="button" onClick={()=>setHostCameraOn(s=>!s)} className={`relative h-7 w-12 rounded-full p-1 transition ${hostCameraOn ? 'bg-green-600' : 'bg-gray-300'}`}>
                      <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${hostCameraOn ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                  <label className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer ${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <span className={`${textPri} text-sm font-medium`}>Microphone</span>
                    <button type="button" onClick={()=>setHostAudioOn(s=>!s)} className={`relative h-7 w-12 rounded-full p-1 transition ${hostAudioOn ? 'bg-green-600' : 'bg-gray-300'}`}>
                      <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${hostAudioOn ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={()=>setShowHostJoin(false)} className={`px-4 py-2 rounded-lg font-medium transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>Cancel</button>
                  <button onClick={async () => {
                    if(!pendingMeetingId) return
                    const authRaw = localStorage.getItem('auth')
                    let hostUserId = ''
                    try { const a = JSON.parse(authRaw||'null'); hostUserId = a?.user?._id || a?.user?.id || '' } catch {}
                    if(!hostUserId) {
                      alert('You must be logged in to start a meeting.')
                      return
                    }
                    const id = pendingMeetingId
                    try {
                      const resp: any = await createMeeting({ code: id, hostUserId, title: hostName ? `${hostName}'s Meeting` : 'Instant Meeting' })
                      const shareUrl = resp.shareUrl || makeLink(id)
                      const m: Meeting = {
                        id,
                        title: hostName ? `${hostName}'s Meeting` : 'Instant Meeting',
                        startAt: new Date().toISOString(),
                        durationMins: 60,
                        link: shareUrl,
                        createdAt: new Date().toISOString(),
                      }
                      setMeetings(prev=>[m,...prev])
                      localStorage.setItem('rc_current_meeting', JSON.stringify({ id, host: true, name: hostName || 'Host', cameraOn: hostCameraOn, audioOn: hostAudioOn, shareUrl }))
                      setShowHostJoin(false)
                      window.location.href = `/call?m=${id}`
                    } catch (e: any) {
                      alert(e?.message || 'Failed to create meeting')
                    }
                  }} className={`px-4 py-2 rounded-lg font-semibold transition ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>Start meeting</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard