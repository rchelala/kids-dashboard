import { useState } from 'react'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

function ChoreRow({ chore, done, onToggle }) {
  return (
    <div className={`chore-item ${done ? 'completed' : ''}`} onClick={() => onToggle(chore.id)}>
      <span className="chore-emoji">{chore.emoji}</span>
      <span className="chore-name">{chore.name}</span>
      <span className="chore-check">{done ? '✓' : ''}</span>
    </div>
  )
}

export default function ChoreList({ chores, onWeekdayToggle, onWeekendToggle }) {
  const [tab, setTab] = useState('daily')

  if (!chores) return null

  const weekendDay = isWeekend()
  const dayName = WEEKDAY_NAMES[new Date().getDay()]
  const todayCompletions = chores.todayCompletions || []

  const weekdayItems = chores.weekday?.items || []
  const weekendPool = chores.weekend?.pool || []
  const activeWeekend = chores.weekend?.active || []
  const weekendCompletions = chores.weekend?.completions || {}
  const activeWeekendChores = weekendPool.filter(c => activeWeekend.includes(c.id))

  // Weekend chores only exist Sat/Sun, so the tab bar only appears then —
  // on a weekday there's nothing to switch to. Tabbing rather than stacking
  // keeps a single scrollable list in the panel, which the Pi touchscreen
  // needs: two scroll areas in one card made it nearly impossible to scroll.
  const tabbed = weekendDay
  const activeTab = tabbed ? tab : 'daily'

  const dailyDone = todayCompletions.length
  const weekendDone = activeWeekendChores.filter(c => weekendCompletions[c.id]).length

  const done = activeTab === 'weekend' ? weekendDone : dailyDone
  const total = activeTab === 'weekend' ? activeWeekendChores.length : weekdayItems.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="card card-gold" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {tabbed ? (
        <div className="right-panel-tabs">
          <button
            className={`right-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setTab('daily')}
          >
            ⭐ {dayName} ({dailyDone}/{weekdayItems.length})
          </button>
          <button
            className={`right-tab-btn ${activeTab === 'weekend' ? 'active' : ''}`}
            onClick={() => setTab('weekend')}
          >
            🌟 Weekend ({weekendDone}/{activeWeekendChores.length})
          </button>
        </div>
      ) : (
        <div className="card-title">⭐ {dayName}'s Chores</div>
      )}

      {activeTab === 'daily' && (
        <div className="chore-list">
          {weekdayItems.map(chore => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              done={todayCompletions.includes(chore.id)}
              onToggle={onWeekdayToggle}
            />
          ))}
        </div>
      )}

      {activeTab === 'weekend' && (
        activeWeekendChores.length === 0 ? (
          <div className="no-weekend-chores">
            <div style={{ fontSize: '2.5rem' }}>😴</div>
            <div style={{ fontWeight: 700 }}>No weekend chores yet!</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: 4 }}>
              Dad will add them soon
            </div>
          </div>
        ) : (
          <div className="chore-list">
            {activeWeekendChores.map(chore => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                done={!!weekendCompletions[chore.id]}
                onToggle={onWeekendToggle}
              />
            ))}
          </div>
        )
      )}

      {/* ── Progress ────────────────────────────────────────────────────── */}
      <div className="chore-progress" style={{ marginTop: 'auto' }}>
        <div className="progress-stats">
          <span>
            {activeTab === 'weekend' ? 'Weekend' : 'Today'}: {done}/{total}
          </span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
