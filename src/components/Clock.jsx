import { useState, useEffect, useMemo } from 'react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const QUOTES = [
  "You are braver than you believe! 🦁",
  "Every big job starts with one small step. 🚀",
  "You've got this — one chore at a time! ⭐",
  "Hard work today means fun time tomorrow! 🎉",
  "You're doing awesome — keep it up! 💪",
  "Champions do their chores first! 🏆",
  "Small wins add up to big victories! 🌟",
  "Be the superhero of your own story! 🦸",
  "Today is a great day to be great! ✨",
  "You make this family proud every single day! ❤️",
  "Believe in yourself — you're unstoppable! 🌈",
  "Great things happen when you try your best! 🎯",
  "You're stronger than any chore on that list! 💥",
  "One task at a time — you've totally got this! 🎈",
  "Helping out makes you a real-life hero! 🌠",
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

export default function Clock({ childName, message }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { display, seconds, ampm } = formatTime(now)
  const greeting = getGreeting(now.getHours())
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`

  const quote = useMemo(() => {
    const dayOfYear = Math.floor(Date.now() / 86400000)
    return QUOTES[dayOfYear % QUOTES.length]
  }, [])

  const displayMessage = message?.trim() || quote

  return (
    <>
      {/* Left: greeting + quote */}
      <div className="clock-left">
        <div className="clock-greeting">{greeting}, {childName}!</div>
        <div className="clock-quote">{displayMessage}</div>
      </div>

      {/* Center: big time + date */}
      <div className="clock-center">
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
    </>
  )
}
