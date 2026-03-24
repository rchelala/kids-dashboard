import { useState, useEffect, useRef } from 'react'
import { playSound } from '../utils/sounds'

const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' }

function getNextAlarm(alarms) {
  const now = new Date()
  const currentDay = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  let best = null
  let bestDiff = Infinity

  for (const alarm of alarms) {
    if (!alarm.enabled) continue
    const [h, m] = alarm.time.split(':').map(Number)
    const alarmMinutes = h * 60 + m
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7
      if (!alarm.days.includes(DAY_MAP[checkDay])) continue
      if (dayOffset === 0 && alarmMinutes <= currentMinutes) continue
      const diff = dayOffset * 1440 + alarmMinutes - currentMinutes
      if (diff < bestDiff) { bestDiff = diff; best = { alarm, diffMinutes: diff } }
      break
    }
  }
  return best
}

function formatCountdown(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${m}m`
}

function formatAlarmTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function AlarmDisplay({ alarms, activeAlarm, onDismiss }) {
  const [tick, setTick] = useState(0)
  const soundInterval = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  // Play the alarm's chosen sound on repeat when active
  useEffect(() => {
    if (activeAlarm) {
      const sound = activeAlarm.sound || 'rocket'
      playSound(sound)
      soundInterval.current = setInterval(() => playSound(sound), 3000)
    } else {
      clearInterval(soundInterval.current)
    }
    return () => clearInterval(soundInterval.current)
  }, [activeAlarm])

  const nextAlarm = getNextAlarm(alarms)

  if (activeAlarm) {
    return (
      <div className="alarm-overlay">
        <div className="alarm-modal">
          <div className="alarm-modal-icon">⏰</div>
          <div className="alarm-modal-time">{formatAlarmTime(activeAlarm.time)}</div>
          <div className="alarm-modal-label">{activeAlarm.label}</div>
          <button className="alarm-dismiss-btn" onClick={onDismiss}>I'm Awake! 🙌</button>
        </div>
      </div>
    )
  }

  return (
    <div className="alarm-bar">
      <span className="alarm-icon">⏰</span>
      {nextAlarm ? (
        <>
          <span className="alarm-info">
            Next alarm: <strong>{formatAlarmTime(nextAlarm.alarm.time)}</strong>
            {' '}— {nextAlarm.alarm.label}
          </span>
          <span className="alarm-countdown">{formatCountdown(nextAlarm.diffMinutes)}</span>
        </>
      ) : (
        <span>No alarms set — add one in Parent Settings ⚙️</span>
      )}
    </div>
  )
}
