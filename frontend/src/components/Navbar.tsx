import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FiUser } from 'react-icons/fi'

const Navbar: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState<boolean>(() => !!localStorage.getItem('auth'))

  // Update auth state if localStorage changes (e.g., login/logout in another tab)
  useEffect(() => {
    const handleStorage = () => setIsAuthed(!!localStorage.getItem('auth'))
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="#" className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-500 text-white font-bold">
                RC
              </div>
              <span className="text-lg font-semibold text-gray-800">RuralCall</span>
            </a>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex sm:items-center">
            {isAuthed ? (
              <Link
                to="/dashboard"
                aria-label="Profile"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <FiUser className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden">
            <button
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label="Toggle menu"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
            >
              <svg className={`h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="sm:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {isAuthed ? (
              <Link
                to="/dashboard"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-base font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <FiUser className="w-5 h-5" /> Profile
              </Link>
            ) : (
              <Link
                to="/login"
                className="block w-full text-center px-3 py-2 rounded-md text-base font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar