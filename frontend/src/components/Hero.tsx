import React from 'react'
import { Link } from 'react-router'

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-r from-green-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900">
              Connect your community with reliable video calls
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              RuralCall is built for low-bandwidth areas — simple, accessible video calls with a lightweight UI
              so families, health workers and teachers can stay connected.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-3">
              <Link
                to="/join"
                className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Start a Call
              </Link>

              <span
                
                className="inline-flex items-center justify-center px-6 py-3 bg-white border border-green-600 text-green-600 hover:bg-green-50 rounded-md text-base font-medium"
              >
                Learn more
              </span>
            </div>

            <p className="mt-4 text-sm text-gray-500">No signup required for guests • Optimized for low connectivity</p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-center h-40 bg-green-50 rounded-md">
                {/* simple camera icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 7h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
                </svg>
              </div>
              <div className="mt-4 text-center text-sm text-gray-600">Lightweight call preview — minimal UI, low bandwidth</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero