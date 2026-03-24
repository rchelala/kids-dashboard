import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

export default function Celebration({ childName, earnings, allowance, type, onDone }) {
  const intervalRef = useRef(null)
  const isFullWeek = type === 'weekend'
  const isMaxEarnings = earnings != null && allowance != null && earnings >= allowance

  useEffect(() => {
    const fire = () => {
      const opts = {
        particleCount: isFullWeek ? 140 : 80,
        spread: isFullWeek ? 90 : 60,
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#34D399', '#60A5FA']
      }
      confetti({ ...opts, origin: { x: 0.3, y: 0.5 } })
      confetti({ ...opts, origin: { x: 0.7, y: 0.5 } })
    }

    fire()
    intervalRef.current = setInterval(fire, isFullWeek ? 2500 : 4000)

    // Auto-dismiss daily celebrations after 5 seconds
    let autoTimer
    if (!isFullWeek) {
      autoTimer = setTimeout(onDone, 5000)
    }

    return () => {
      clearInterval(intervalRef.current)
      clearTimeout(autoTimer)
      confetti.reset()
    }
  }, [isFullWeek, onDone])

  return (
    <div className="celebration-overlay">
      <span className="celebration-stars">✨</span>

      {isFullWeek ? (
        <>
          <div className="celebration-emoji">🏆</div>
          <div className="celebration-title">Amazing Week, {childName}!</div>
          <div className="celebration-subtitle">All weekend chores complete!</div>
          {earnings != null && (
            <div className="celebration-amount">
              {isMaxEarnings
                ? `💰 Full $${allowance?.toFixed(2)} earned! 🎉`
                : `💰 You earned $${earnings.toFixed(2)} this week!`}
            </div>
          )}
          {!isMaxEarnings && earnings != null && (
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
              Keep it up next week for the full ${allowance?.toFixed(2)}!
            </div>
          )}
        </>
      ) : (
        <>
          <div className="celebration-emoji">🌟</div>
          <div className="celebration-title">All done for today!</div>
          <div className="celebration-subtitle">Great job, {childName}!</div>
          {earnings != null && (
            <div className="celebration-amount">
              On track for ${earnings.toFixed(2)} this week 💰
            </div>
          )}
        </>
      )}

      <button className="celebration-done-btn" onClick={onDone}>
        {isFullWeek ? '🎉 Awesome! Thanks!' : '😊 Thanks!'}
      </button>
    </div>
  )
}
