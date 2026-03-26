import { useState, useEffect } from 'react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function getGreeting(hour) {
  if (hour < 5)  return '🌙 Good Night'
  if (hour < 12) return '☀️ Good Morning'
  if (hour < 17) return '🌤️ Good Afternoon'
  if (hour < 21) return '🌆 Good Evening'
  return '🌙 Good Night'
}

function formatTime(date) {
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return { display: `${hours}:${minutes}`, seconds, ampm }
}

export default function Clock({ childName }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { display, seconds, ampm } = formatTime(now)
  const greeting = getGreeting(now.getHours())
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`

  return (
    <div className="clock-left">
      <div className="clock-greeting">{greeting}, {childName}!</div>
      <div className="clock-time">
        {display}
        <span style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>
          :{seconds}
        </span>
        <span style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
          {ampm}
        </span>
      </div>
      <div className="clock-date">{dateStr}</div>
    </div>
  )
}
