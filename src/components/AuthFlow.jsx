import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const KID_EMOJIS = ['⭐', '🚀', '🦁', '🐉', '🦊', '🐬', '🦋', '🎮', '⚽', '🎵', '🌟', '🎯']

export default function AuthFlow({ onReady }) {
  const [screen, setScreen] = useState('check') // check | login | signup | setup | kids
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [setupMode, setSetupMode] = useState('new') // 'new' | 'join'
  const [kidName, setKidName] = useState('')
  const [kidEmoji, setKidEmoji] = useState('⭐')
  const [inviteCode, setInviteCode] = useState('')

  const [kids, setKids] = useState([])
  const [pendingContext, setPendingContext] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) checkFamily(session)
      else setScreen('login')
    })
  }, [])

  async function checkFamily(session) {
    setLoading(true)
    const { data: member } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', session.user.id)
      .single()

    if (!member) {
      setLoading(false)
      setScreen('setup')
      return
    }

    const { data: kidsData } = await supabase
      .from('kids')
      .select('*')
      .eq('family_id', member.family_id)
      .order('created_at')

    setLoading(false)

    if (!kidsData || kidsData.length === 0) {
      setScreen('setup')
      return
    }

    if (kidsData.length === 1) {
      onReady({ session, kid: kidsData[0], familyId: member.family_id })
    } else {
      setKids(kidsData)
      setPendingContext({ session, familyId: member.family_id })
      setScreen('kids')
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    await checkFamily(data.session)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    if (!data.session) {
      setError('Check your email to confirm your account, then sign in.')
      setLoading(false)
      setScreen('login')
      return
    }
    setLoading(false)
    setScreen('setup')
  }

  async function handleSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()

    if (setupMode === 'new') {
      if (!kidName.trim()) { setLoading(false); return }
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ kidName: kidName.trim(), kidEmoji })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      onReady({ session, kid: data.kid, familyId: data.familyId })
    } else {
      if (!inviteCode.trim()) { setLoading(false); return }
      const res = await fetch('/api/families/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid invite code'); setLoading(false); return }

      const { data: kidsData } = await supabase
        .from('kids')
        .select('*')
        .eq('family_id', data.familyId)
        .order('created_at')

      setLoading(false)
      if (kidsData.length === 1) {
        onReady({ session, kid: kidsData[0], familyId: data.familyId })
      } else {
        setKids(kidsData)
        setPendingContext({ session, familyId: data.familyId })
        setScreen('kids')
      }
    }
  }

  if (screen === 'check' || (loading && screen === 'check')) {
    return (
      <div className="login-screen">
        <div className="stars-bg" />
        <div className="loading-text">🚀 Loading...</div>
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <div className="login-screen">
        <div className="stars-bg" />
        <div className="login-card">
          <div className="login-rocket">🚀</div>
          <h1 className="login-title">Kid Dashboard</h1>
          <p className="login-subtitle">Sign in to continue</p>
          <form onSubmit={handleLogin} className="login-form">
            <input className="pw-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus autoComplete="email" />
            <input className="pw-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            {error && <p className="pw-error">{error}</p>}
            <button type="submit" className="pw-submit-btn" disabled={loading || !email || !password}>
              {loading ? '...' : 'Sign In'}
            </button>
          </form>
          <button className="auth-link-btn" onClick={() => { setScreen('signup'); setError('') }}>
            New here? Create Account
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'signup') {
    return (
      <div className="login-screen">
        <div className="stars-bg" />
        <div className="login-card">
          <div className="login-rocket">✨</div>
          <h1 className="login-title">Create Account</h1>
          <p className="login-subtitle">Parent / guardian account</p>
          <form onSubmit={handleSignup} className="login-form">
            <input className="pw-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus autoComplete="email" />
            <input className="pw-input" type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            {error && <p className="pw-error">{error}</p>}
            <button type="submit" className="pw-submit-btn" disabled={loading || !email || !password}>
              {loading ? '...' : 'Continue →'}
            </button>
          </form>
          <button className="auth-link-btn" onClick={() => { setScreen('login'); setError('') }}>
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'setup') {
    return (
      <div className="login-screen">
        <div className="stars-bg" />
        <div className="login-card" style={{ maxWidth: 440 }}>
          <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, width: '100%' }}>
            {[['new', '➕ New Family'], ['join', '🔑 Join Family']].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => { setSetupMode(mode); setError('') }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.15s', background: setupMode === mode ? 'rgba(255,255,255,0.12)' : 'transparent', color: setupMode === mode ? 'white' : 'rgba(255,255,255,0.5)' }}
              >{label}</button>
            ))}
          </div>

          {setupMode === 'new' ? (
            <>
              <div className="login-rocket" style={{ marginTop: 8 }}>👶</div>
              <h1 className="login-title">Add Your Kid</h1>
              <p className="login-subtitle">Who's this dashboard for?</p>
              <form onSubmit={handleSetup} className="login-form">
                <input className="pw-input" placeholder="Kid's name" value={kidName} onChange={e => setKidName(e.target.value)} autoFocus style={{ textAlign: 'center' }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {KID_EMOJIS.map(em => (
                    <span key={em} onClick={() => setKidEmoji(em)} style={{ fontSize: '1.8rem', cursor: 'pointer', padding: 6, borderRadius: 8, border: `2px solid ${kidEmoji === em ? 'var(--purple)' : 'transparent'}`, background: kidEmoji === em ? 'rgba(167,139,250,0.15)' : 'transparent', transition: 'all 0.15s' }}>{em}</span>
                  ))}
                </div>
                {error && <p className="pw-error">{error}</p>}
                <button type="submit" className="pw-submit-btn" disabled={loading || !kidName.trim()}>
                  {loading ? '...' : "Let's Go! 🚀"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="login-rocket" style={{ marginTop: 8 }}>🔑</div>
              <h1 className="login-title">Join Your Family</h1>
              <p className="login-subtitle">Enter the invite code from your partner</p>
              <form onSubmit={handleSetup} className="login-form">
                <input className="pw-input login-code-input" placeholder="INVITE CODE" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} autoFocus />
                {error && <p className="pw-error">{error}</p>}
                <button type="submit" className="pw-submit-btn" disabled={loading || !inviteCode.trim()}>
                  {loading ? '...' : 'Join Family'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    )
  }

  if (screen === 'kids') {
    return (
      <div className="login-screen">
        <div className="stars-bg" />
        <div className="login-card" style={{ maxWidth: 420 }}>
          <div className="login-rocket">👨‍👩‍👧‍👦</div>
          <h1 className="login-title">Whose dashboard?</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
            {kids.map(kid => (
              <button
                key={kid.id}
                onClick={() => onReady({ ...pendingContext, kid })}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, cursor: 'pointer', color: 'white', fontFamily: 'var(--font)', fontSize: '1.1rem', fontWeight: 700, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <span style={{ fontSize: '2rem' }}>{kid.emoji}</span>
                {kid.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}
