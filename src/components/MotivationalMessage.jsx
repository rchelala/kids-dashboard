import { useMemo } from 'react'

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

export default function MotivationalMessage({ message }) {
  // Pick a quote that cycles daily (same quote all day, changes at midnight)
  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor(Date.now() / 86400000)
    return QUOTES[dayOfYear % QUOTES.length]
  }, [])

  const display = message?.trim() || dailyQuote

  return (
    <div className="motivational-message">
      <span className="motivational-text">{display}</span>
    </div>
  )
}
