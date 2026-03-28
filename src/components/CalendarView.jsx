import { useState } from 'react'
import ChallengePanel from './ChallengePanel'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, currentMonth: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, currentMonth: true })
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, currentMonth: false })
  return cells
}

function formatEventDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`
}

export default function CalendarView({ events, challenges, onChallengeToggle }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [tab, setTab] = useState('calendar')

  const days = buildCalendarDays(viewYear, viewMonth)

  const eventDays = new Set()
  events.forEach(ev => {
    const [y, m] = ev.date.split('-').map(Number)
    if (y === viewYear && m - 1 === viewMonth) eventDays.add(Number(ev.date.split('-')[2]))
  })

  const todayStr = today.toISOString().split('T')[0]
  const upcoming = [...events]
    .filter(ev => ev.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="card card-purple" style={{ height: '100%' }}>
      <div className="right-panel-tabs">
        <button className={`right-tab-btn ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>📅 Calendar</button>
        <button className={`right-tab-btn ${tab === 'challenges' ? 'active' : ''}`} onClick={() => setTab('challenges')}>💪 Challenges</button>
      </div>

      {tab === 'calendar' ? (
        <>
          <div className="calendar-header">
            <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
            <span className="calendar-month-name">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
          </div>

          <div className="calendar-grid">
            {DAY_HEADERS.map(h => (
              <div key={h} className="cal-day-header">{h}</div>
            ))}
            {days.map((cell, idx) => {
              const isToday = cell.currentMonth && cell.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
              const hasEvent = cell.currentMonth && eventDays.has(cell.day)
              return (
                <div key={idx} className={['cal-day', isToday ? 'today' : '', hasEvent ? 'has-event' : '', !cell.currentMonth ? 'other-month' : ''].join(' ')}>
                  {cell.day}
                  {hasEvent && <span className="event-dot" />}
                </div>
              )
            })}
          </div>

          <div className="cal-events-list">
            <div className="cal-events-title">Upcoming</div>
            {upcoming.length === 0 ? (
              <div className="no-events">No upcoming events</div>
            ) : (
              upcoming.map(ev => (
                <div key={ev.id} className="cal-event-item" style={{ borderLeft: `3px solid ${ev.color}` }}>
                  <span>{ev.emoji}</span>
                  <span className="cal-event-title">{ev.title}</span>
                  <span className="cal-event-date">{formatEventDate(ev.date)}</span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <ChallengePanel challenges={challenges || []} onToggle={onChallengeToggle} />
      )}
    </div>
  )
}
