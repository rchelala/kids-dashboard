import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import Clock from './components/Clock'
import ChoreList from './components/ChoreList'
import CalendarView from './components/CalendarView'
import AlarmDisplay from './components/AlarmDisplay'
import Celebration from './components/Celebration'
import AdminPanel from './components/AdminPanel'
import AuthFlow from './components/AuthFlow'
import WeatherWidget from './components/WeatherWidget'
import AvatarCharacter from './components/AvatarCharacter'

const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

// Active hours: 5:30am - 6:30pm. Outside this window the kiosk stops polling
// to keep Vercel function invocations under the free-tier limit. The local
// alarm check loop keeps running, so the morning alarm still fires on time.
function isActiveHours() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  return minutes >= (5 * 60 + 30) && minutes < (18 * 60 + 30)
}

// Dismissed alarms are persisted so a kiosk reload inside the same minute
// doesn't immediately re-fire an alarm the kid already turned off. Keys embed
// the date, so anything not from today is dropped on load.
const DISMISSED_KEY = 'dismissedAlarms'

function loadDismissedAlarms() {
  try {
    const saved = JSON.parse(localStorage.getItem(DISMISSED_KEY))
    if (!Array.isArray(saved)) return new Set()
    const today = new Date().toDateString()
    return new Set(saved.filter(k => typeof k === 'string' && k.includes(today)))
  } catch { return new Set() }
}

function saveDismissedAlarms(keys) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys])) } catch {}
}

function deriveChoreState(chores) {
  if (!chores) return 'some'
  const isAfter10am = new Date().getHours() >= 10

  if (!isWeekend()) {
    const todayDone = chores.todayCompletions || []
    const items = chores.weekday?.items || []
    if (items.length === 0) return 'some'
    if (items.every(c => todayDone.includes(c.id))) return 'all'
    if (items.some(c => todayDone.includes(c.id))) return 'some'
    return isAfter10am ? 'none' : 'some'
  } else {
    const active = chores.weekend?.active || []
    const completions = chores.weekend?.completions || {}
    if (active.length === 0) return 'some'
    if (active.every(id => completions[id])) return 'all'
    if (active.some(id => completions[id])) return 'some'
    return isAfter10am ? 'none' : 'some'
  }
}

export default function App() {
  const [authCtx, setAuthCtx] = useState(null) // { session, kid, familyId }
  const authCtxRef = useRef(null)

  const [chores, setChores] = useState(null)
  const [alarms, setAlarms] = useState([])
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState(null)
  const [balance, setBalance] = useState(null)
  const [challenges, setChallenges] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)
  const [showCelebration, setShowCelebration] = useState(null)
  const [activeAlarm, setActiveAlarm] = useState(null)
  const [dismissedAlarms, setDismissedAlarms] = useState(loadDismissedAlarms)
  const [lastChoreCheckedAt, setLastChoreCheckedAt] = useState(null)
  const [justLoggedIn, setJustLoggedIn] = useState(false)

  function handleReady(ctx) {
    authCtxRef.current = ctx
    setAuthCtx(ctx)
  }

  useEffect(() => {
    if (!authCtx) return
    setJustLoggedIn(true)
    const id = setTimeout(() => setJustLoggedIn(false), 5000)
    return () => clearTimeout(id)
  }, [authCtx])

  // Authenticated fetch — JWT + kid/family headers on every request
  const authFetch = useCallback(async (url, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const ctx = authCtxRef.current
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
    if (session) headers['Authorization'] = `Bearer ${session.access_token}`
    if (ctx?.kid && !headers['x-kid-id']) headers['x-kid-id'] = ctx.kid.id
    if (ctx?.familyId) headers['x-family-id'] = ctx.familyId
    return fetch(url, { ...options, headers })
  }, [])

  const fetchData = useCallback(async () => {
    if (!authCtxRef.current) return
    try {
      const res = await authFetch('/api/snapshot')
      const data = await res.json()
      if (data.chores) setChores(data.chores)
      if (data.alarms) setAlarms(data.alarms)
      if (data.events) setEvents(data.events)
      if (data.settings) setSettings(data.settings)
      if (data.balance) setBalance(data.balance)
      setChallenges(Array.isArray(data.challenges) ? data.challenges : [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }, [authFetch])

  useEffect(() => {
    if (!authCtx) return
    // First load: always fetch so the kiosk has data, even if started during quiet hours.
    fetchData()
    // Then poll every 5 minutes, but skip the network call outside active hours.
    const id = setInterval(() => {
      if (isActiveHours()) fetchData()
    }, 300000)
    return () => clearInterval(id)
  }, [authCtx, fetchData])

  // Alarm check every second
  useEffect(() => {
    const check = () => {
      const now = new Date()
      if (now.getSeconds() !== 0) return
      const currentDay = DAY_MAP[now.getDay()]
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const timeStr = `${hh}:${mm}`
      for (const alarm of alarms) {
        if (!alarm.enabled) continue
        if (!alarm.days.includes(currentDay)) continue
        if (alarm.time !== timeStr) continue
        const key = `${alarm.id}-${now.toDateString()}-${timeStr}`
        if (dismissedAlarms.has(key)) continue
        setActiveAlarm({ ...alarm, dismissKey: key })
        break
      }
    }
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [alarms, dismissedAlarms])

  function checkCelebration(updated) {
    const today = getTodayKey()
    if (!isWeekend()) {
      const todayDone = updated.todayCompletions || []
      const items = updated.weekday?.items || []
      const allDone = items.length > 0 && items.every(c => todayDone.includes(c.id))
      if (allDone && !updated.celebrationShown?.[today]) {
        setShowCelebration({ type: 'daily', date: today })
      }
    } else {
      const active = updated.weekend?.active || []
      const completions = updated.weekend?.completions || {}
      const allDone = active.length > 0 && active.every(id => completions[id])
      if (allDone && !updated.weekendCelebrationShown) {
        setShowCelebration({ type: 'weekend' })
      }
    }
  }

  const handleWeekdayToggle = async (choreId) => {
    try {
      const res = await authFetch(`/api/chores/weekday/${choreId}/toggle`, { method: 'POST' })
      const updated = await res.json()
      setChores(updated)
      setLastChoreCheckedAt(Date.now())
      checkCelebration(updated)
    } catch (err) { console.error(err) }
  }

  const handleWeekendToggle = async (choreId) => {
    try {
      const res = await authFetch(`/api/chores/weekend/${choreId}/toggle`, { method: 'POST' })
      const updated = await res.json()
      setChores(updated)
      setLastChoreCheckedAt(Date.now())
      checkCelebration(updated)
    } catch (err) { console.error(err) }
  }

  const handleCelebrationDone = async () => {
    const celebration = showCelebration
    setShowCelebration(null)
    if (!celebration) return
    await authFetch('/api/chores/celebration-shown', {
      method: 'POST',
      body: JSON.stringify({ type: celebration.type, date: celebration.date })
    })
    setChores(prev => {
      if (!prev) return prev
      if (celebration.type === 'weekend') return { ...prev, weekendCelebrationShown: true }
      return { ...prev, celebrationShown: { ...prev.celebrationShown, [celebration.date]: true } }
    })
  }

  const handleChallengeToggle = async (challengeId) => {
    try {
      const res = await authFetch(`/api/challenges/${challengeId}/complete`, { method: 'POST' })
      const updated = await res.json()
      setChallenges(Array.isArray(updated) ? updated : [])
    } catch (err) { console.error(err) }
  }

  const handleDismissAlarm = () => {
    if (activeAlarm) {
      setDismissedAlarms(prev => {
        const next = new Set([...prev, activeAlarm.dismissKey])
        saveDismissedAlarms(next)
        return next
      })
    }
    setActiveAlarm(null)
  }

  const handleAdminClose = () => {
    setShowAdmin(false)
    fetchData()
  }

  const handleSwitchKid = () => {
    // Reset auth context — AuthFlow will reuse the existing session and show kid picker
    setAuthCtx(null)
    authCtxRef.current = null
  }

  if (!authCtx) {
    return <AuthFlow onReady={handleReady} />
  }

  if (!settings) {
    return (
      <div className="loading">
        <div className="loading-text">🚀 Loading {authCtx.kid.name}'s Dashboard...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="stars-bg" />
      <button className="admin-btn" onClick={() => setShowAdmin(true)} title="Parent Settings">⚙️</button>
      <button className="switch-kid-btn" onClick={handleSwitchKid} title="Switch kid">
        {authCtx.kid.emoji} {authCtx.kid.name}
      </button>

      <div className="kiosk-layout">
        <div className="header-card">
          <Clock childName={authCtx.kid.name} message={settings?.dailyMessage} />
          <WeatherWidget />
        </div>
        <div className="middle-section">
          <div className="left-panel">
            <ChoreList
              chores={chores}
              settings={settings}
              balance={balance}
              onWeekdayToggle={handleWeekdayToggle}
              onWeekendToggle={handleWeekendToggle}
            />
          </div>
          <div className="right-panel">
            <CalendarView events={events} challenges={challenges} onChallengeToggle={handleChallengeToggle} />
          </div>
        </div>
        <div className="bottom-section">
          <AlarmDisplay alarms={alarms} activeAlarm={activeAlarm} onDismiss={handleDismissAlarm} />
        </div>
      </div>

      {showCelebration && chores && (
        <Celebration
          childName={authCtx.kid.name}
          earnings={chores.earnings?.earnings}
          allowance={settings.allowanceAmount}
          type={showCelebration.type}
          onDone={handleCelebrationDone}
        />
      )}

      {showAdmin && (
        <AdminPanel
          chores={chores}
          alarms={alarms}
          events={events}
          settings={settings}
          balance={balance}
          challenges={challenges}
          kid={authCtx.kid}
          familyId={authCtx.familyId}
          authFetch={authFetch}
          onClose={handleAdminClose}
          onSwitchKid={handleSwitchKid}
        />
      )}

      <AvatarCharacter
        kidId={authCtx.kid.id}
        alarmActive={!!activeAlarm}
        choreState={deriveChoreState(chores)}
        lastChoreAt={lastChoreCheckedAt}
        justLoggedIn={justLoggedIn}
      />
    </div>
  )
}
