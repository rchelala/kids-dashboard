import { useState } from 'react'
import { SOUND_OPTIONS, playSound } from '../utils/sounds'

const CHORE_EMOJIS = ['🛏️', '💩', '🐾', '🧹', '🍽️', '🐕', '🐈', '🌿', '🚿', '👕', '📚', '🗑️', '🧺', '✅', '🚗', '🪴', '🪣', '🧽']
const EVENT_EMOJIS = ['🎂', '⚽', '🎮', '🏥', '🏫', '🎉', '🎵', '✈️', '🏖️', '🎁', '📅', '🦷', '💉', '🎭']
const EVENT_COLORS = ['#4ECDC4', '#FF6B6B', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F472B6']
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' }

function formatAlarmTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminPanel({ chores, alarms, events, settings, balance, familyId, authFetch, onClose }) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [tab, setTab] = useState('chores')

  // Local state mirrors
  const [localChores, setLocalChores] = useState(chores)
  const [localAlarms, setLocalAlarms] = useState(alarms)
  const [localEvents, setLocalEvents] = useState(events)
  const [localBalance, setLocalBalance] = useState(balance)

  // Weekday chore form
  const [newWdName, setNewWdName] = useState('')
  const [newWdEmoji, setNewWdEmoji] = useState('✅')

  // Weekend pool form
  const [newWeEmoji, setNewWeEmoji] = useState('✅')
  const [newWeName, setNewWeName] = useState('')

  // Weekend custom chore form
  const [customChoreName, setCustomChoreName] = useState('')
  const [customChoreEmoji, setCustomChoreEmoji] = useState('✅')

  // Pending active weekend selection (before saving)
  const [pendingActive, setPendingActive] = useState(null)
  const activeWeekend = pendingActive ?? localChores?.weekend?.active ?? []

  // Alarm form
  const [newAlarmTime, setNewAlarmTime] = useState('06:00')
  const [newAlarmLabel, setNewAlarmLabel] = useState('Wake up!')
  const [newAlarmDays, setNewAlarmDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri'])
  const [newAlarmSound, setNewAlarmSound] = useState('rocket')

  // Calendar form
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventEmoji, setNewEventEmoji] = useState('📅')
  const [newEventColor, setNewEventColor] = useState('#4ECDC4')
  const [icalInput, setIcalInput] = useState(settings?.icalUrl || '')
  const [icalSaved, setIcalSaved] = useState(false)

  // Kids tab
  const [kids, setKids] = useState(null)
  const [newKidName, setNewKidName] = useState('')
  const [newKidEmoji, setNewKidEmoji] = useState('⭐')

  async function loadKids() {
    if (kids !== null) return
    const res = await authFetch('/api/families/kids')
    setKids(await res.json())
  }

  async function addKid() {
    if (!newKidName.trim()) return
    const res = await authFetch('/api/families/kids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kidName: newKidName.trim(), kidEmoji: newKidEmoji })
    })
    setKids(await res.json())
    setNewKidName('')
    setNewKidEmoji('⭐')
  }

  // Wallet form
  const [spendAmount, setSpendAmount] = useState('')
  const [spendNote, setSpendNote] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  // Settings form
  const [newName, setNewName] = useState('')
  const [newAllowance, setNewAllowance] = useState('')
  const [newDeduction, setNewDeduction] = useState('')
  const [newAdminPin, setNewAdminPin] = useState('')
  const [newInviteCode, setNewInviteCode] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  // ── Auth ────────────────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault()
    const res = await authFetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (res.ok) { setAuthed(true); setPwError('') }
    else { setPwError('Wrong password. Try again.'); setPassword('') }
  }

  // ── Weekday chores ───────────────────────────────────────────────────────────

  async function addWeekdayChore() {
    if (!newWdName.trim()) return
    const res = await authFetch('/api/admin/chores/weekday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWdName.trim(), emoji: newWdEmoji })
    })
    setLocalChores(await res.json())
    setNewWdName('')
    setNewWdEmoji('✅')
  }

  async function deleteWeekdayChore(id) {
    const res = await authFetch(`/api/admin/chores/weekday/${id}`, { method: 'DELETE' })
    setLocalChores(await res.json())
  }

  // ── Weekend pool ─────────────────────────────────────────────────────────────

  async function addToPool() {
    if (!newWeName.trim()) return
    const res = await authFetch('/api/admin/chores/weekend/pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWeName.trim(), emoji: newWeEmoji })
    })
    setLocalChores(await res.json())
    setNewWeName('')
    setNewWeEmoji('✅')
    setPendingActive(null)
  }

  async function removeFromPool(id) {
    const res = await authFetch(`/api/admin/chores/weekend/pool/${id}`, { method: 'DELETE' })
    setLocalChores(await res.json())
    setPendingActive(null)
  }

  function toggleWeekendActivation(id) {
    setPendingActive(prev => {
      const current = prev ?? localChores?.weekend?.active ?? []
      return current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    })
  }

  async function saveWeekendActivation() {
    const res = await authFetch('/api/admin/chores/weekend/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: activeWeekend })
    })
    setLocalChores(await res.json())
    setPendingActive(null)
  }

  async function addCustomWeekendChore() {
    if (!customChoreName.trim()) return
    const res = await authFetch('/api/admin/chores/weekend/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: customChoreName.trim(), emoji: customChoreEmoji })
    })
    setLocalChores(await res.json())
    setCustomChoreName('')
    setCustomChoreEmoji('✅')
    setPendingActive(null)
  }

  async function resetWeek() {
    const res = await authFetch('/api/admin/chores/reset', { method: 'POST' })
    setLocalChores(await res.json())
  }

  // ── Alarms ───────────────────────────────────────────────────────────────────

  async function addAlarm() {
    if (!newAlarmTime || newAlarmDays.length === 0) return
    const res = await authFetch('/api/admin/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: newAlarmTime, label: newAlarmLabel, days: newAlarmDays, sound: newAlarmSound })
    })
    setLocalAlarms(await res.json())
    setNewAlarmLabel('Wake up!')
    setNewAlarmTime('06:00')
  }

  async function toggleAlarm(alarm) {
    const res = await authFetch(`/api/admin/alarms/${alarm.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !alarm.enabled })
    })
    setLocalAlarms(await res.json())
  }

  async function deleteAlarm(id) {
    const res = await authFetch(`/api/admin/alarms/${id}`, { method: 'DELETE' })
    setLocalAlarms(await res.json())
  }

  function toggleDay(day) {
    setNewAlarmDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  // ── Calendar ─────────────────────────────────────────────────────────────────

  async function addEvent() {
    if (!newEventTitle.trim() || !newEventDate) return
    const res = await authFetch('/api/admin/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newEventTitle.trim(), date: newEventDate, emoji: newEventEmoji, color: newEventColor })
    })
    setLocalEvents(await res.json())
    setNewEventTitle('')
    setNewEventDate('')
  }

  async function deleteEvent(id) {
    const res = await authFetch(`/api/admin/calendar/${id}`, { method: 'DELETE' })
    setLocalEvents(await res.json())
  }

  async function saveIcalUrl() {
    await authFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icalUrl: icalInput.trim() || null })
    })
    setIcalSaved(true)
    setTimeout(() => setIcalSaved(false), 2000)
  }

  // ── Wallet ───────────────────────────────────────────────────────────────────

  async function logSpend() {
    const amt = parseFloat(spendAmount)
    if (isNaN(amt) || amt <= 0) return
    const res = await authFetch('/api/admin/balance/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, note: spendNote.trim() || 'Purchase' })
    })
    setLocalBalance(await res.json())
    setSpendAmount(''); setSpendNote('')
  }

  async function adjustBalance() {
    const amt = parseFloat(adjustAmount)
    if (isNaN(amt)) return
    const res = await authFetch('/api/admin/balance/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, note: adjustNote.trim() || 'Manual adjustment' })
    })
    setLocalBalance(await res.json())
    setAdjustAmount(''); setAdjustNote('')
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  async function saveSettings() {
    const body = {}
    if (newName.trim()) body.childName = newName.trim()
    if (newAllowance) body.allowanceAmount = Number(newAllowance)
    if (newDeduction) body.deductionPerMissedChore = Number(newDeduction)
    if (newAdminPin.trim()) body.adminPin = newAdminPin.trim()
    if (newInviteCode.trim()) body.inviteCode = newInviteCode.trim().toUpperCase()
    if (Object.keys(body).length === 0) return
    await authFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
    setNewName(''); setNewAllowance(''); setNewDeduction(''); setNewAdminPin(''); setNewInviteCode('')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const pool = localChores?.weekend?.pool || []

  return (
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-header">
          <span className="admin-title">⚙️ Parent Settings</span>
          <button className="admin-close-btn" onClick={onClose}>✕</button>
        </div>

        {!authed ? (
          <form className="password-form" onSubmit={handleLogin}>
            <h2>🔒 Parent Access</h2>
            <p>Enter your password to continue</p>
            <input
              className="pw-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {pwError && <div className="pw-error">{pwError}</div>}
            <button type="submit" className="pw-submit-btn">Unlock</button>
          </form>
        ) : (
          <>
            <div className="admin-tabs">
              {['chores', 'weekend', 'alarms', 'calendar', 'wallet', 'history', 'kids', 'settings'].map(t => (
                <button
                  key={t}
                  className={`tab-btn ${tab === t ? 'active' : ''}`}
                  onClick={() => { setTab(t); if (t === 'kids') loadKids() }}
                >
                  {{ chores: '📋 Weekday', weekend: '🌟 Weekend', alarms: '⏰ Alarms', calendar: '📅 Calendar', wallet: '🐷 Wallet', history: '📊 History', kids: '👶 Kids', settings: '🔧 Settings' }[t]}
                </button>
              ))}
            </div>

            <div className="admin-body">

              {/* ── WEEKDAY CHORES ────────────────────────────────────────── */}
              {tab === 'chores' && (
                <>
                  <div className="admin-section-title">Add Weekday Chore</div>
                  <div className="admin-form-row" style={{ alignItems: 'flex-start' }}>
                    <div className="admin-input-group">
                      <label className="admin-label">Name</label>
                      <input
                        className="admin-input"
                        placeholder="e.g. Make bed"
                        value={newWdName}
                        onChange={e => setNewWdName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addWeekdayChore()}
                      />
                    </div>
                    <button className="admin-btn-add" onClick={addWeekdayChore}>Add</button>
                  </div>
                  <div>
                    <label className="admin-label">Emoji</label>
                    <div className="emoji-picker">
                      {CHORE_EMOJIS.map(em => (
                        <span key={em} className={`emoji-option ${newWdEmoji === em ? 'selected' : ''}`} onClick={() => setNewWdEmoji(em)}>{em}</span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-section-title" style={{ marginTop: 12 }}>Current Weekday Chores</div>
                  <div className="admin-list">
                    {(localChores?.weekday?.items || []).map(chore => (
                      <div key={chore.id} className="admin-list-item">
                        <span style={{ fontSize: '1.4rem' }}>{chore.emoji}</span>
                        <div className="admin-list-item-info">{chore.name}
                          <div className="admin-list-item-sub">Daily — Mon to Fri</div>
                        </div>
                        <button className="admin-btn-danger" onClick={() => deleteWeekdayChore(chore.id)}>Remove</button>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <button
                      className="admin-btn-secondary"
                      onClick={() => { if (window.confirm('Reset all chore completions for this week?')) resetWeek() }}
                    >
                      🔄 Reset This Week's Completions
                    </button>
                  </div>
                </>
              )}

              {/* ── WEEKEND CHORES ────────────────────────────────────────── */}
              {tab === 'weekend' && (
                <>
                  {/* This Weekend section */}
                  <div className="admin-section-title">This Weekend's Chores</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    Check which chores Asher should do this weekend
                  </div>
                  {pool.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: 8 }}>
                      Add chores to the pool below first
                    </div>
                  ) : (
                    <>
                      <div className="admin-list">
                        {pool.map(chore => (
                          <div
                            key={chore.id}
                            className="admin-list-item"
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleWeekendActivation(chore.id)}
                          >
                            <span style={{ fontSize: '1.4rem' }}>{chore.emoji}</span>
                            <span className="admin-list-item-info">{chore.name}</span>
                            <span style={{ fontSize: '1.4rem' }}>
                              {activeWeekend.includes(chore.id) ? '✅' : '⬜'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {pendingActive !== null && (
                        <button className="admin-btn-add" style={{ marginTop: 8 }} onClick={saveWeekendActivation}>
                          Save This Weekend's Selection
                        </button>
                      )}
                    </>
                  )}

                  {/* Custom one-off */}
                  <div className="admin-section-title" style={{ marginTop: 16 }}>Add One-Off Chore This Weekend</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    Adds to pool and activates immediately
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-input-group">
                      <input
                        className="admin-input"
                        placeholder="e.g. Wash the car"
                        value={customChoreName}
                        onChange={e => setCustomChoreName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomWeekendChore()}
                      />
                    </div>
                    <button className="admin-btn-add" onClick={addCustomWeekendChore}>Add & Activate</button>
                  </div>
                  <div>
                    <label className="admin-label">Emoji</label>
                    <div className="emoji-picker">
                      {CHORE_EMOJIS.map(em => (
                        <span key={em} className={`emoji-option ${customChoreEmoji === em ? 'selected' : ''}`} onClick={() => setCustomChoreEmoji(em)}>{em}</span>
                      ))}
                    </div>
                  </div>

                  {/* Pool management */}
                  <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="admin-section-title">Manage Chore Pool</div>
                    <div className="admin-form-row" style={{ alignItems: 'flex-start' }}>
                      <div className="admin-input-group">
                        <label className="admin-label">Add to Pool</label>
                        <input
                          className="admin-input"
                          placeholder="e.g. Vacuum living room"
                          value={newWeName}
                          onChange={e => setNewWeName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addToPool()}
                        />
                      </div>
                      <button className="admin-btn-add" onClick={addToPool}>Add</button>
                    </div>
                    <div>
                      <label className="admin-label">Emoji</label>
                      <div className="emoji-picker">
                        {CHORE_EMOJIS.map(em => (
                          <span key={em} className={`emoji-option ${newWeEmoji === em ? 'selected' : ''}`} onClick={() => setNewWeEmoji(em)}>{em}</span>
                        ))}
                      </div>
                    </div>
                    {pool.length > 0 && (
                      <div className="admin-list" style={{ marginTop: 8 }}>
                        {pool.map(chore => (
                          <div key={chore.id} className="admin-list-item">
                            <span style={{ fontSize: '1.4rem' }}>{chore.emoji}</span>
                            <span className="admin-list-item-info">{chore.name}</span>
                            <button className="admin-btn-danger" onClick={() => removeFromPool(chore.id)}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── ALARMS ───────────────────────────────────────────────── */}
              {tab === 'alarms' && (
                <>
                  <div className="admin-section-title">Add a New Alarm</div>
                  <div className="admin-form-row">
                    <div className="admin-input-group">
                      <label className="admin-label">Time</label>
                      <input type="time" className="admin-input" value={newAlarmTime} onChange={e => setNewAlarmTime(e.target.value)} />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-label">Label</label>
                      <input className="admin-input" placeholder="Wake up!" value={newAlarmLabel} onChange={e => setNewAlarmLabel(e.target.value)} />
                    </div>
                    <button className="admin-btn-add" onClick={addAlarm}>Add</button>
                  </div>
                  <div>
                    <label className="admin-label">Days</label>
                    <div className="days-grid">
                      {DAYS.map(d => (
                        <span key={d} className={`day-chip ${newAlarmDays.includes(d) ? 'selected' : ''}`} onClick={() => toggleDay(d)}>
                          {DAY_LABELS[d]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label className="admin-label">Alarm Sound</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {SOUND_OPTIONS.map(s => (
                        <button
                          key={s.id}
                          className={`day-chip ${newAlarmSound === s.id ? 'selected' : ''}`}
                          onClick={() => { setNewAlarmSound(s.id); playSound(s.id) }}
                          style={{ fontSize: '0.85rem' }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="admin-section-title" style={{ marginTop: 12 }}>Active Alarms</div>
                  {localAlarms.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No alarms yet</div>
                  ) : (
                    <div className="admin-list">
                      {localAlarms.map(alarm => (
                        <div key={alarm.id} className="admin-list-item">
                          <div className="admin-list-item-info">
                            <div>{formatAlarmTime(alarm.time)} — {alarm.label}</div>
                            <div className="admin-list-item-sub">
                              {alarm.days.map(d => DAY_LABELS[d]).join(', ')} · {SOUND_OPTIONS.find(s => s.id === alarm.sound)?.label || '🎵 Default'}
                            </div>
                          </div>
                          <label className="toggle">
                            <input type="checkbox" checked={alarm.enabled} onChange={() => toggleAlarm(alarm)} />
                            <span className="toggle-slider" />
                          </label>
                          <button className="admin-btn-danger" onClick={() => deleteAlarm(alarm.id)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── CALENDAR ─────────────────────────────────────────────── */}
              {tab === 'calendar' && (
                <>
                  {/* iCal sync */}
                  <div className="admin-section-title">Google / Apple Calendar Sync</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    Paste your iCal feed URL to auto-sync your calendar events
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ flex: 1 }}>
                      <input
                        className="admin-input"
                        placeholder="https://calendar.google.com/calendar/ical/..."
                        value={icalInput}
                        onChange={e => setIcalInput(e.target.value)}
                      />
                    </div>
                    <button className="admin-btn-add" onClick={saveIcalUrl}>
                      {icalSaved ? '✅ Saved!' : 'Save'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
                    Google: Calendar Settings → your calendar → "Secret address in iCal format"<br />
                    Apple: iCloud.com → Calendar → Share → Copy Link
                  </div>

                  {/* Manual events */}
                  <div className="admin-section-title">Add an Event Manually</div>
                  <div className="admin-form-row">
                    <div className="admin-input-group">
                      <label className="admin-label">Event Name</label>
                      <input className="admin-input" placeholder="e.g. Soccer Game" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} />
                    </div>
                    <div className="admin-input-group" style={{ maxWidth: 160 }}>
                      <label className="admin-label">Date</label>
                      <input type="date" className="admin-input" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} />
                    </div>
                    <button className="admin-btn-add" onClick={addEvent}>Add</button>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <label className="admin-label">Emoji</label>
                      <div className="emoji-picker">
                        {EVENT_EMOJIS.map(em => (
                          <span key={em} className={`emoji-option ${newEventEmoji === em ? 'selected' : ''}`} onClick={() => setNewEventEmoji(em)}>{em}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="admin-label">Color</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {EVENT_COLORS.map(c => (
                          <div key={c} onClick={() => setNewEventColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: newEventColor === c ? '3px solid white' : '3px solid transparent', transition: 'border 0.15s' }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="admin-section-title" style={{ marginTop: 12 }}>Manual Events</div>
                  {localEvents.filter(e => !e.source).length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No manual events yet</div>
                  ) : (
                    <div className="admin-list">
                      {[...localEvents].filter(e => !e.source).sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
                        <div key={ev.id} className="admin-list-item">
                          <span style={{ fontSize: '1.4rem' }}>{ev.emoji}</span>
                          <div className="admin-list-item-info">
                            {ev.title}
                            <div className="admin-list-item-sub">{formatDate(ev.date)}</div>
                          </div>
                          <button className="admin-btn-danger" onClick={() => deleteEvent(ev.id)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── WALLET ───────────────────────────────────────────────── */}
              {tab === 'wallet' && (
                <>
                  {/* Big balance display */}
                  <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                      Savings Jar Balance
                    </div>
                    <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '3rem', color: (localBalance?.balance ?? 0) >= 0 ? '#34D399' : '#FF6B6B' }}>
                      ${(localBalance?.balance ?? 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Log a purchase */}
                  <div className="admin-section-title">Asher Spent...</div>
                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ maxWidth: 120 }}>
                      <label className="admin-label">Amount ($)</label>
                      <input
                        type="number"
                        className="admin-input"
                        placeholder="0.00"
                        value={spendAmount}
                        min="0"
                        step="0.01"
                        onChange={e => setSpendAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && logSpend()}
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-label">What did he buy?</label>
                      <input
                        className="admin-input"
                        placeholder="e.g. Roblox, toy, snack"
                        value={spendNote}
                        onChange={e => setSpendNote(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && logSpend()}
                      />
                    </div>
                    <button className="admin-btn-danger" style={{ alignSelf: 'flex-end', padding: '10px 16px', fontSize: '0.9rem' }} onClick={logSpend}>
                      Deduct
                    </button>
                  </div>

                  {/* Manual adjustment */}
                  <div className="admin-section-title" style={{ marginTop: 12 }}>Manual Adjustment</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                    Use a positive number to add money, negative to subtract (e.g. -2.00)
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-input-group" style={{ maxWidth: 120 }}>
                      <label className="admin-label">Amount ($)</label>
                      <input
                        type="number"
                        className="admin-input"
                        placeholder="+5.00"
                        value={adjustAmount}
                        step="0.01"
                        onChange={e => setAdjustAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && adjustBalance()}
                      />
                    </div>
                    <div className="admin-input-group">
                      <label className="admin-label">Note</label>
                      <input
                        className="admin-input"
                        placeholder="e.g. Birthday money"
                        value={adjustNote}
                        onChange={e => setAdjustNote(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && adjustBalance()}
                      />
                    </div>
                    <button className="admin-btn-add" style={{ alignSelf: 'flex-end' }} onClick={adjustBalance}>
                      Apply
                    </button>
                  </div>

                  {/* Transaction history */}
                  <div className="admin-section-title" style={{ marginTop: 16 }}>Transaction History</div>
                  {(!localBalance?.transactions || localBalance.transactions.length === 0) ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No transactions yet</div>
                  ) : (
                    <div className="admin-list">
                      {[...localBalance.transactions].reverse().map(tx => {
                        const isEarn = tx.type === 'earn'
                        const isSpend = tx.type === 'spend'
                        const sign = isSpend ? '-' : tx.amount >= 0 ? '+' : ''
                        const color = isSpend ? '#FF6B6B' : tx.amount >= 0 ? '#34D399' : '#FF6B6B'
                        const icon = isEarn ? '📅' : isSpend ? '🛍️' : tx.amount >= 0 ? '➕' : '➖'
                        return (
                          <div key={tx.id} className="admin-list-item">
                            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                            <div className="admin-list-item-info">
                              {tx.note}
                              <div className="admin-list-item-sub">{tx.date}</div>
                            </div>
                            <span style={{ fontWeight: 800, color, whiteSpace: 'nowrap' }}>
                              {sign}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ── KIDS ─────────────────────────────────────────────────── */}
              {tab === 'kids' && (
                <>
                  <div className="admin-section-title">Your Kids</div>
                  <div className="admin-list">
                    {(kids || []).map(kid => (
                      <div key={kid.id} className="admin-list-item">
                        <span style={{ fontSize: '1.5rem' }}>{kid.emoji}</span>
                        <div className="admin-list-item-info">{kid.name}</div>
                      </div>
                    ))}
                    {kids !== null && kids.length === 0 && (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No kids yet</div>
                    )}
                  </div>

                  <div className="admin-section-title" style={{ marginTop: 16 }}>Add a Kid</div>
                  <div className="admin-form-row" style={{ alignItems: 'flex-start' }}>
                    <div className="admin-input-group">
                      <label className="admin-label">Name</label>
                      <input
                        className="admin-input"
                        placeholder="Kid's name"
                        value={newKidName}
                        onChange={e => setNewKidName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addKid()}
                      />
                    </div>
                    <button className="admin-btn-add" onClick={addKid}>Add</button>
                  </div>
                  <div>
                    <label className="admin-label">Emoji</label>
                    <div className="emoji-picker">
                      {['⭐','🚀','🦁','🐉','🦊','🐬','🦋','🎮','⚽','🎵','🌟','🎯'].map(em => (
                        <span key={em} className={`emoji-option ${newKidEmoji === em ? 'selected' : ''}`} onClick={() => setNewKidEmoji(em)}>{em}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                    After adding a kid, close this panel and tap the kid's name at the top of the dashboard to switch between kids.
                  </div>
                </>
              )}

              {/* ── HISTORY ──────────────────────────────────────────────── */}
              {tab === 'history' && (
                <>
                  <div className="admin-section-title">Weekly History</div>
                  {(!localChores?.history || localChores.history.length === 0) ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>No history yet — check back after the first week!</div>
                  ) : (
                    <div className="history-grid">
                      {[...localChores.history].reverse().map((h, i) => (
                        <div key={i} className="history-item">
                          <div className="history-week">Week of {h.week}</div>
                          <div className="history-status" style={{ fontSize: '1.8rem' }}>
                            {h.earnings >= (settings?.allowanceAmount ?? 3) ? '🏆' : h.earnings > 0 ? '⭐' : '📋'}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#FFD700' }}>
                            ${h.earnings?.toFixed(2) ?? '—'}
                          </div>
                          <div className="history-count">
                            {h.totalActual}/{h.totalPossible} chores
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── SETTINGS ─────────────────────────────────────────────── */}
              {tab === 'settings' && (
                <>
                  <div className="admin-section-title">Update Settings</div>
                  <div className="admin-input-group">
                    <label className="admin-label">Child's Name (leave blank to keep current)</label>
                    <input className="admin-input" placeholder={settings?.childName || 'Asher'} value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>
                  <div className="admin-input-group">
                    <label className="admin-label">Weekly Allowance ($)</label>
                    <input type="number" className="admin-input" placeholder={settings?.allowanceAmount ?? 3} value={newAllowance} min="0" step="0.50" onChange={e => setNewAllowance(e.target.value)} />
                  </div>
                  <div className="admin-input-group">
                    <label className="admin-label">Deduction per Missed Chore ($)</label>
                    <input type="number" className="admin-input" placeholder={settings?.deductionPerMissedChore ?? 0.25} value={newDeduction} min="0" step="0.05" onChange={e => setNewDeduction(e.target.value)} />
                  </div>
                  <div className="admin-section-title" style={{ marginTop: 16 }}>Family Invite Code</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    Share this with your partner so they can join the family.
                  </div>
                  <div style={{ background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>🔑</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal)', letterSpacing: 2 }}>
                      {settings?.inviteCode || '—'}
                    </span>
                  </div>
                  <div className="admin-input-group">
                    <label className="admin-label">New Invite Code (leave blank to keep current)</label>
                    <input className="admin-input" placeholder="e.g. RCFAMILY" value={newInviteCode} onChange={e => setNewInviteCode(e.target.value.toUpperCase())} />
                  </div>

                  <div className="admin-section-title" style={{ marginTop: 16 }}>Settings Panel PIN</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    PIN to unlock this settings panel (so kids can't change things).
                  </div>
                  <div className="admin-input-group">
                    <label className="admin-label">New PIN (leave blank to keep current)</label>
                    <input type="password" className="admin-input" placeholder="New PIN..." value={newAdminPin} onChange={e => setNewAdminPin(e.target.value)} />
                  </div>
                  <button className="admin-btn-add" onClick={saveSettings}>
                    {settingsSaved ? '✅ Saved!' : 'Save Changes'}
                  </button>
                </>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}
