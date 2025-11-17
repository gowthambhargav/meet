import React, { useState } from 'react'
import { login } from '../utils/api'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password')
      return
    }
    try {
      const data = await login({ email, password })
      // persist auth (token + user) as returned by backend
      localStorage.setItem('auth', JSON.stringify(data))
      // optional remember flag can be used to extend lifetime in a real app
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Sign in</h2>
          <p className="mt-2 text-gray-600">Access RuralCall with your account</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14zM10 4C5.291 4 1.471 7.134.858 11.246a1 1 0 101.932.518C3.555 8.602 6.523 6 10 6c1.657 0 3.219.42 4.586 1.158a1 1 0 10.828-1.832A6.02 6.02 0 0010 4zM15.5 12a3.5 3.5 0 01-3.5 3.5H9a1 1 0 100 2h3a5.5 5.5 0 100-11H9a1 1 0 100 2h3.5A3.5 3.5 0 0115.5 12z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
              <span className="text-sm text-gray-700 font-medium">Remember me</span>
            </label>

            <a href="#forgot" className="text-sm font-medium text-green-600 hover:text-green-700">
              Forgot password?
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
            Sign in
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" className="font-semibold text-green-600 hover:text-green-700">
              Sign up
            </a>
          </p>
          <p className="mt-3 text-sm">
            <a href="/" className="font-semibold text-gray-700 hover:text-green-600">
              ← Back to home
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login