import React, { useEffect } from 'react'
import { FiCheckCircle, FiArrowRight, FiLogIn } from 'react-icons/fi'

const Thankyou: React.FC = () => {
  const handleRejoin = () => {
    // Redirect to join page
    window.location.href = '/join'
  }

  const handleToDashboard = () => {
    const token = localStorage.getItem('authToken')
    if (token) {
      // Redirect to dashboard if authenticated
      window.location.href = '/dashboard'
    } else {
      // Redirect to join page if not authenticated
      window.location.href = '/join'
    }
  }

  useEffect(() => {
    // Optional: Auto-redirect after 5 seconds if token exists
    const timer = setTimeout(() => {
      const token = localStorage.getItem('authToken')
      if (token) {
        window.location.href = '/dashboard'
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
            <FiCheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Thank you!</h1>
        <p className="text-lg text-gray-600 mb-8">
          Your meeting has ended. Thanks for joining RuralCall.
        </p>

        {/* Call Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Meeting Duration</span>
              <span className="font-semibold text-gray-900">24 minutes</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Participants</span>
              <span className="font-semibold text-gray-900">5 people</span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex items-center justify-between text-sm">
              <span className="text-gray-600">Meeting ID</span>
              <span className="font-semibold text-gray-900 font-mono">ABC-123-XYZ</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleToDashboard}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition"
          >
            <FiArrowRight  className="w-5 h-5" />
            {localStorage.getItem('authToken') ? 'Go to Dashboard' : 'Join as Guest'}
          </button>

          <button
            onClick={handleRejoin}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-green-600 text-green-600 hover:bg-green-50 font-semibold rounded-lg transition"
          >
            <FiLogIn className="w-5 h-5" />
            Rejoin Meeting
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-sm text-gray-500">
          Redirecting to dashboard in 5 seconds...
        </p>
      </div>
    </div>
  )
}

export default Thankyou