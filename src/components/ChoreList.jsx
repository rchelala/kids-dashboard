const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

export default function ChoreList({ chores, settings, balance, onWeekdayToggle, onWeekendToggle }) {
  if (!chores) return null

  const weekendDay = isWeekend()
  const dayName = WEEKDAY_NAMES[new Date().getDay()]
  const todayCompletions = chores.todayCompletions || []
  const earnings = chores.earnings || {}

  const weekdayItems = chores.weekday?.items || []
  const weekendPool = chores.weekend?.pool || []
  const activeWeekend = chores.weekend?.active || []
  const weekendCompletions = chores.weekend?.completions || {}
  const activeWeekendChores = weekendPool.filter(c => activeWeekend.includes(c.id))

  const projected = earnings.earnings ?? settings?.allowanceAmount ?? 3

  // Daily progress — always today's everyday chore completions
  const todayDone = todayCompletions.length
  const todayTotal = weekdayItems.length
  const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0

  return (
    <div className="card card-gold" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Everyday chores (shown every day) ─────────────────────────── */}
      <div className="card-title">⭐ {dayName}'s Chores</div>
      <div className="chore-list">
        {weekdayItems.map(chore => {
          const done = todayCompletions.includes(chore.id)
          return (
            <div
              key={chore.id}
              className={`chore-item ${done ? 'completed' : ''}`}
              onClick={() => onWeekdayToggle(chore.id)}
            >
              <span className="chore-emoji">{chore.emoji}</span>
              <span className="chore-name">{chore.name}</span>
              <span className="chore-check">{done ? '✓' : ''}</span>
            </div>
          )
        })}
      </div>

      {/* ── Weekend chores (only on Sat/Sun) ───────────────────────────── */}
      {weekendDay && (
        <>
          <div className="card-title" style={{ marginTop: 12 }}>🌟 Weekend Chores</div>
          {activeWeekendChores.length === 0 ? (
            <div className="no-weekend-chores">
              <div style={{ fontSize: '2.5rem' }}>😴</div>
              <div style={{ fontWeight: 700 }}>No weekend chores yet!</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: 4 }}>
                Dad will add them soon
              </div>
            </div>
          ) : (
            <div className="chore-list">
              {activeWeekendChores.map(chore => {
                const done = !!weekendCompletions[chore.id]
                return (
                  <div
                    key={chore.id}
                    className={`chore-item ${done ? 'completed' : ''}`}
                    onClick={() => onWeekendToggle(chore.id)}
                  >
                    <span className="chore-emoji">{chore.emoji}</span>
                    <span className="chore-name">{chore.name}</span>
                    <span className="chore-check">{done ? '✓' : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Progress & earnings ─────────────────────────────────────────── */}
      <div className="chore-progress" style={{ marginTop: 'auto' }}>
        <div className="progress-stats">
          <span>
            Today: {todayDone}/{todayTotal}
          </span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {settings?.rewardDescription && (
          <div className="allowance-badge">
            🎯 Reward: {settings.rewardDescription}
            {earnings.totalMissed === 0 && earnings.totalPossible > 0 && ' 🎉'}
          </div>
        )}
        {balance != null && (
          <div className="savings-badge">
            🐷 Savings Jar: ${balance.balance.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  )
}
