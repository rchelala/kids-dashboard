import { useState } from 'react'

export default function LoginScreen({ onLogin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      })
      const data = await res.json()
      if (data.success) {
        onLogin(data.role)
      } else {
        setError('Wrong code — try again!')
        setCode('')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="stars-bg" />
      <div className="login-card">
        <div className="login-rocket">🚀</div>
        <h1 className="login-title">Asher's Dashboard</h1>
        <p className="login-subtitle">Enter your invite code to continue</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="pw-input login-code-input"
            type="password"
            placeholder="Enter code..."
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
            autoComplete="off"
          />
          {error && <p className="pw-error">{error}</p>}
          <button type="submit" className="pw-submit-btn" disabled={loading || !code.trim()}>
            {loading ? '...' : '✨ Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
