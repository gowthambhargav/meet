import React, { useState } from 'react'

const CallJoinForm: React.FC = () => {
  const [name, setName] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [isGuest, setIsGuest] = useState(true)
  const [email, setEmail] = useState('')
  const [cameraOn, setCameraOn] = useState(true)
  const [audioOn, setAudioOn] = useState(true)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Please enter your name')
    if (!meetingId.trim()) return setError('Please enter meeting id')
    if (isGuest && !email.trim()) return setError('Please enter email to join as guest')

    // Persist basic join info for the Call page to read
    localStorage.setItem('rc_name', name.trim())
    localStorage.setItem('rc_meeting', meetingId.trim())
    localStorage.setItem('rc_isGuest', String(isGuest))
    if (isGuest && email.trim()) localStorage.setItem('rc_email', email.trim())
    localStorage.setItem('rc_cameraOn', String(cameraOn))
    localStorage.setItem('rc_audioOn', String(audioOn))

    // Navigate to call page with meeting and name in query for convenience
    const q = new URLSearchParams({ m: meetingId.trim(), n: name.trim() }).toString()
    window.location.href = `/call?${q}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 7h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Join a meeting</h2>
          <p className="mt-2 text-gray-600">Enter your details and meeting info to get started</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                Your name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="e.g., Asha Kumar"
              />
            </div>

            <div>
              <label htmlFor="meetingId" className="block text-sm font-semibold text-gray-700 mb-2">
                Meeting ID
              </label>
              <input
                id="meetingId"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="123-456-789"
              />
            </div>
          </div>

          {isGuest && (
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email (for guest)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="name@example.com"
              />
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Meeting preferences</p>
            
            <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-green-300 transition">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="font-medium text-gray-900">Camera</div>
                  <div className="text-xs text-gray-500">{cameraOn ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setCameraOn((s) => !s)} 
                className={`relative h-8 w-14 rounded-full p-1 transition ${cameraOn ? 'bg-green-600' : 'bg-gray-300'}`} 
                aria-pressed={cameraOn}
              >
                <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${cameraOn ? 'translate-x-6' : ''}`} />
              </button>
            </label>

            <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-green-300 transition">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="font-medium text-gray-900">Microphone</div>
                  <div className="text-xs text-gray-500">{audioOn ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setAudioOn((s) => !s)} 
                className={`relative h-8 w-14 rounded-full p-1 transition ${audioOn ? 'bg-green-600' : 'bg-gray-300'}`} 
                aria-pressed={audioOn}
              >
                <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${audioOn ? 'translate-x-6' : ''}`} />
              </button>
            </label>
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
              <span className="text-sm text-gray-700 font-medium">Join as guest</span>
            </label>

            <a href="/login" className="text-sm font-medium text-green-600 hover:text-green-700">
              Sign in instead
            </a>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Join Meeting
          </button>
        </form>
      </div>
    </div>
  )
}

export default CallJoinForm