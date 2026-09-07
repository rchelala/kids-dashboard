import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// How long the "Redeemed!" flash stays on a row. Kept short and cleared on
// unmount — transient kiosk state needs a hard timeout so it can't compound.
const FLASH_MS = 2500

export default function RewardShop({ rewards, balance, stars, onRedeem }) {
  const [confirming, setConfirming] = useState(null) // the reward awaiting confirmation
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [flashId, setFlashId] = useState(null)
  const flashTimer = useRef(null)

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  if (!rewards) return null

  const jar = Number(balance?.balance || 0)
  // The server keeps the true balance, which can dip negative if a chore is
  // unchecked after a redeem. Clamp for display only — it self-heals.
  const starBalance = Math.max(0, Number(stars?.balance || 0))

  const closeConfirm = () => {
    if (busy) return
    setConfirming(null)
    setError(null)
  }

  const doRedeem = async () => {
    if (busy || !confirming || !onRedeem) return
    setBusy(true)
    setError(null)
    const message = await onRedeem(confirming.id)
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    const id = confirming.id
    setConfirming(null)
    setFlashId(id)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), FLASH_MS)
  }

  if (rewards.length === 0) {
    return (
      <div className="reward-empty">
        <div style={{ fontSize: '2.5rem' }}>🎁</div>
        <div style={{ fontWeight: 700 }}>No rewards yet!</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: 4 }}>Dad will add one soon</div>
      </div>
    )
  }

  const cost = r => Number(r.star_cost || 0)
  const affordable = rewards.filter(r => cost(r) > 0 && cost(r) <= starBalance)
  const locked = rewards.filter(r => cost(r) > 0 && cost(r) > starBalance)
  const unpriced = rewards.filter(r => cost(r) === 0)

  return (
    <div className="reward-list">
      <div className="reward-stars">⭐ {starBalance} {starBalance === 1 ? 'star' : 'stars'}</div>
      <div className="reward-jar">🐷 Savings Jar: ${jar.toFixed(2)}</div>

      {affordable.map(r => (
        <div key={r.id} className="reward-item">
          <span className="reward-emoji">{r.emoji}</span>
          <span className="reward-title">{r.title}</span>
          {flashId === r.id ? (
            <span className="reward-flash">Redeemed! 🎉</span>
          ) : (
            <>
              <span className="reward-price">{cost(r)} ⭐</span>
              <button className="reward-redeem-btn" onClick={() => setConfirming(r)}>Redeem</button>
            </>
          )}
        </div>
      ))}

      {locked.map(r => (
        <div key={r.id} className="reward-item locked">
          <span className="reward-emoji">{r.emoji}</span>
          <span className="reward-title">{r.title}</span>
          <span className="reward-price">
            {cost(r)} ⭐
            <span className="reward-needed">{cost(r) - starBalance} ⭐ to go</span>
          </span>
        </div>
      ))}

      {unpriced.map(r => (
        <div key={r.id} className="reward-item">
          <span className="reward-emoji">{r.emoji}</span>
          <span className="reward-title">{r.title}</span>
          <span className="reward-price">${Number(r.price).toFixed(2)}</span>
        </div>
      ))}

      {/* Portalled to <body>: the enclosing .card sets backdrop-filter, which makes
          it the containing block for fixed-position children — without this the
          dialog would be trapped inside the right panel instead of covering the screen. */}
      {confirming && createPortal(
        <div
          className="reward-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm reward"
          onClick={closeConfirm}
          onKeyDown={e => e.key === 'Escape' && closeConfirm()}
          tabIndex={-1}
        >
          <div className="reward-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="reward-confirm-emoji">{confirming.emoji}</div>
            <div className="reward-confirm-title">{confirming.title}</div>
            <div className="reward-confirm-cost">
              Use {cost(confirming)} {cost(confirming) === 1 ? 'star' : 'stars'}?
            </div>
            {error && <div className="reward-confirm-error">{error}</div>}
            <div className="reward-confirm-actions">
              <button className="reward-confirm-no" onClick={closeConfirm} disabled={busy}>Not yet</button>
              <button className="reward-confirm-yes" onClick={doRedeem} disabled={busy}>
                {busy ? 'Wait…' : 'Yes! 🎉'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
