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
import MotivationalMessage from './components/MotivationalMessage'

const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

export default function App() {
  const [authCtx, setAuthCtx] = useState(null) // { session, kid, familyId }
  const authCtxRef = useRef(null)

  const [chores, setChores] = useState(null)
  const [alarms, setAlarms] = useState([])
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState(null)
  const [balance, setBalance] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showCelebration, setShowCelebration] = useState(null)
  const [activeAlarm, setActiveAlarm] = useState(null)
  const [dismissedAlarms, setDismissedAlarms] = useState(new Set())

  function handleReady(ctx) {
    authCtxRef.current = ctx
    setAuthCtx(ctx)
  }

  // Authenticated fetch — JWT + kid/family headers on every request
  const authFetch = useCallback(async (url, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const ctx = authCtxRef.current
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
    if (session) headers['Authorization'] = `Bearer ${session.access_token}`
    if (ctx?.kid) headers['x-kid-id'] = ctx.kid.id
    if (ctx?.familyId) headers['x-family-id'] = ctx.familyId
    return fetch(url, { ...options, headers })
  }, [])

  const fetchData = useCallback(async () => {
    if (!authCtxRef.current) return
    try {
      const [choresRes, alarmsRes, eventsRes, settingsRes, balanceRes] = await Promise.all([
        authFetch('/api/chores'),
        authFetch('/api/alarms'),
        authFetch('/api/calendar'),
        authFetch('/api/settings'),
        authFetch('/api/balance')
      ])
      const [choresData, alarmsData, eventsData, settingsData, balanceData] = await Promise.all([
        choresRes.json(), alarmsRes.json(), eventsRes.json(), settingsRes.json(), balanceRes.json()
      ])
      setChores(choresData)
      setAlarms(alarmsData)
      setEvents(eventsData)
      setSettings(settingsData)
      setBalance(balanceData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }, [authFetch])

  useEffect(() => {
    if (authCtx) {
      fetchData()
      const id = setInterval(fetchData, 60000)
      return () => clearInterval(id)
    }
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
      checkCelebration(updated)
    } catch (err) { console.error(err) }
  }

  const handleWeekendToggle = async (choreId) => {
    try {
      const res = await authFetch(`/api/chores/weekend/${choreId}/toggle`, { method: 'POST' })
      const updated = await res.json()
      setChores(updated)
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

  const handleDismissAlarm = () => {
    if (activeAlarm) setDismissedAlarms(prev => new Set([...prev, activeAlarm.dismissKey]))
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
          <Clock childName={authCtx.kid.name} />
          <MotivationalMessage message={settings?.dailyMessage} />
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
            <CalendarView events={events} />
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
          kid={authCtx.kid}
          familyId={authCtx.familyId}
          authFetch={authFetch}
          onClose={handleAdminClose}
          onSwitchKid={handleSwitchKid}
        />
      )}
    </div>
  )
}
