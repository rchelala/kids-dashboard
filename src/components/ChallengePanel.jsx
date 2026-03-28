export default function ChallengePanel({ challenges, onToggle }) {
  if (!challenges) return null

  const active = challenges.filter(c => !c.completed)
  const done = challenges.filter(c => c.completed)

  if (challenges.length === 0) {
    return (
      <div className="challenge-empty">
        <div style={{ fontSize: '2.5rem' }}>🏆</div>
        <div style={{ fontWeight: 700 }}>No challenges yet!</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: 4 }}>Dad will add one soon</div>
      </div>
    )
  }

  return (
    <div className="challenge-list">
      {active.map(c => (
        <div key={c.id} className="challenge-item" onClick={() => onToggle(c.id)}>
          <span className="challenge-emoji">{c.emoji}</span>
          <span className="challenge-title">{c.title}</span>
          {c.reward > 0 && <span className="challenge-reward">+${Number(c.reward).toFixed(2)}</span>}
          <span className="challenge-check" />
        </div>
      ))}
      {done.map(c => (
        <div key={c.id} className="challenge-item completed" onClick={() => onToggle(c.id)}>
          <span className="challenge-emoji">{c.emoji}</span>
          <span className="challenge-title">{c.title}</span>
          {c.reward > 0 && <span className="challenge-reward">+${Number(c.reward).toFixed(2)}</span>}
          <span className="challenge-check">✓</span>
        </div>
      ))}
    </div>
  )
}
