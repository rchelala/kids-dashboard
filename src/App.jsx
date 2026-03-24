import { useState, useEffect, useCallback } from 'react'
import Clock from './components/Clock'
import ChoreList from './components/ChoreList'
import CalendarView from './components/CalendarView'
import AlarmDisplay from './components/AlarmDisplay'
import Celebration from './components/Celebration'
import AdminPanel from './components/AdminPanel'
import LoginScreen from './components/LoginScreen'

const SESSION_KEY = 'kid_dash_session'
const SESSION_DAYS = 30

function getStoredAuth() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { role, exp } = JSON.parse(raw)
    if (Date.now() > exp) { localStorage.removeItem(SESSION_KEY); return null }
    return role
  } catch { return null }
}

function saveAuth(role) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role, exp }))
}

const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

export default function App() {
  const [authRole, setAuthRole] = useState(() => getStoredAuth())
  const [chores, setChores] = useState(null)
  const [alarms, setAlarms] = useState([])
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState(null)
  const [balance, setBalance] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showCelebration, setShowCelebration] = useState(null) // { type: 'daily'|'weekend', date? }
  const [activeAlarm, setActiveAlarm] = useState(null)
  const [dismissedAlarms, setDismissedAlarms] = useState(new Set())

  const fetchData = useCallback(async () => {
    try {
      const [choresRes, alarmsRes, eventsRes, settingsRes, balanceRes] = await Promise.all([
        fetch('/api/chores'),
        fetch('/api/alarms'),
        fetch('/api/calendar'),
        fetch('/api/settings'),
        fetch('/api/balance')
      ])
      const [choresData, alarmsData, eventsData, settingsData, balanceData] = await Promise.all([
        choresRes.json(),
        alarmsRes.json(),
        eventsRes.json(),
        settingsRes.json(),
        balanceRes.json()
      ])
      setChores(choresData)
      setAlarms(alarmsData)
      setEvents(eventsData)
      setSettings(settingsData)
      setBalance(balanceData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [fetchData])

  // Check alarms every second
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

  // Check if a celebration should fire after a chore toggle
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
      const res = await fetch(`/api/chores/weekday/${choreId}/toggle`, { method: 'POST' })
      const updated = await res.json()
      setChores(updated)
      checkCelebration(updated)
    } catch (err) {
      console.error('Failed to toggle weekday chore:', err)
    }
  }

  const handleWeekendToggle = async (choreId) => {
    try {
      const res = await fetch(`/api/chores/weekend/${choreId}/toggle`, { method: 'POST' })
      const updated = await res.json()
      setChores(updated)
      checkCelebration(updated)
    } catch (err) {
      console.error('Failed to toggle weekend chore:', err)
    }
  }

  const handleCelebrationDone = async () => {
    const celebration = showCelebration
    setShowCelebration(null)
    if (!celebration) return
    await fetch('/api/chores/celebration-shown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: celebration.type, date: celebration.date })
    })
    setChores(prev => {
      if (!prev) return prev
      if (celebration.type === 'weekend') {
        return { ...prev, weekendCelebrationShown: true }
      }
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

  function handleLogin(role) {
    saveAuth(role)
    setAuthRole(role)
  }

  if (!authRole) {
    return <LoginScreen onLogin={handleLogin} />
  }

  if (!settings) {
    return (
      <div className="loading">
        <div className="loading-text">🚀 Loading Asher's Dashboard...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="stars-bg" />
      <button className="admin-btn" onClick={() => setShowAdmin(true)} title="Parent Settings">⚙️</button>

      <div className="kiosk-layout">
        <div className="top-section">
          <Clock childName={settings.childName} />
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
          childName={settings.childName}
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
          onClose={handleAdminClose}
        />
      )}
    </div>
  )
}
