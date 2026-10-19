import { useState, useEffect } from 'react'

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('ge_unlocked')
    if (saved === 'true') setUnlocked(true)
  }, [])

  function handleUnlock() {
    if (input === import.meta.env.VITE_APP_PASSWORD) {
      sessionStorage.setItem('ge_unlocked', 'true')
      setUnlocked(true)
    } else {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  if (unlocked) return children

  return (
    <div className="min-h-screen bg-blue-700 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl px-6 py-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⚡</div>
          <h1 className="text-xl font-bold text-gray-800">Ganesh Electronics</h1>
          <p className="text-sm text-gray-400 mt-1">Enter password to continue</p>
        </div>
        <input
          type="password"
          placeholder="Password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          className={`w-full border rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 ${
            error ? 'border-red-400 focus:ring-red-300' : 'focus:ring-blue-400'
          }`}
        />
        {error && (
          <p className="text-red-500 text-xs mb-3 text-center">Wrong password</p>
        )}
        <button
          onClick={handleUnlock}
          className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold"
        >
          Unlock
        </button>
      </div>
    </div>
  )
}