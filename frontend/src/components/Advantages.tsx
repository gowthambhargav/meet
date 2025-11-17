import React from 'react'
import { Link } from 'react-router'

const features = [
  {
    title: 'Works on low bandwidth',
    desc: 'Optimized video paths and lightweight UI reduce data use so calls stay stable on slow connections.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h3m0 0a4 4 0 018 0m-8 0H3m9 0h9" />
      </svg>
    ),
  },
  {
    title: 'No signup for guests',
    desc: 'Join or start calls instantly — no account required. Great for one-off family or community check-ins.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth={2} />
      </svg>
    ),
  },
  {
    title: 'Low-cost & lightweight',
    desc: 'Small install size and low CPU usage make the app usable on older phones and community devices.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2v4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6" />
      </svg>
    ),
  },
  {
    title: 'Privacy-first',
    desc: 'End-to-end or local-first options ensure conversations stay private — suitable for health and education use.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657 0-3 4-3s4 1.343 4 3-1.343 3-4 3-4-1.343-4-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7V5a4 4 0 10-8 0v2" />
      </svg>
    ),
  },
  {
    title: 'Accessible & simple UI',
    desc: 'Large buttons, clear labels and local language support help everyone join calls easily.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: 'Built for community services',
    desc: 'Features like scheduling, low-data modes, and simple moderation support health workers and teachers.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V11H3v8a2 2 0 002 2z" />
      </svg>
    ),
  },
]

const Advantages: React.FC = () => {
  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <div className="text-center">
          <h2 className="text-base text-green-600 font-semibold tracking-wide uppercase">Why RuralCall</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold text-gray-900 sm:text-4xl">
            Reliable video calls where they matter most
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-600 mx-auto">
            We solve connectivity, cost and usability challenges so community members and frontline workers can
            connect reliably.
          </p>
        </div>

        <div className="mt-10 grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4 p-6 bg-green-50 rounded-lg">
              <div className="flex-shrink-0">{f.icon}</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/join"
            className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-medium rounded-md shadow-sm"
          >
            Try RuralCall — Start a call
          </Link>
        </div>
      </div>
    </section>
  )
}

export default Advantages