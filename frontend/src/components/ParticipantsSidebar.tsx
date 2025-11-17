import React from 'react'
import { FiUser } from 'react-icons/fi'

type Participant = {
  id: number
  name?: string
  initials?: string
  isSpeaking?: boolean
}

const ParticipantsSidebar: React.FC<{ participants: Participant[] }> = ({ participants }) => {
  return (
    <aside className="space-y-3 bg-gray-600 p-4 rounded-lg">
      {participants.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 p-3 rounded-xl bg-gray-700 hover:bg-green-700/70 transition transform hover:-translate-y-0.5`}
        >
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-full text-white font-bold ${
              p.isSpeaking ? 'bg-yellow-500 ring-2 ring-yellow-400' : 'bg-gray-600'
            }`}
          >
            {p.initials ? p.initials : <FiUser className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{p.name ?? 'Participant'}</div>
            <div className="text-xs text-gray-400 truncate">{p.isSpeaking ? 'Speaking' : 'Participant'}</div>
          </div>
        </div>
      ))}
    </aside>
  )
}

export default ParticipantsSidebar
