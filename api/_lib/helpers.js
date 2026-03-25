const { supabase } = require('./supabase')

let ical = null
try { ical = require('node-ical') } catch (_) {}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMondayKey() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

// ── Settings (from kids table) ────────────────────────────────────────────────

async function getSettings(kidId) {
  const { data } = await supabase.from('kids').select('*').eq('id', kidId).single()
  if (!data) return null
  return {
    childName: data.name,
    kidEmoji: data.emoji,
    allowanceAmount: Number(data.allowance_amount),
    deductionPerMissedChore: Number(data.deduction_per_missed_chore),
    icalUrl: data.ical_url
  }
}

async function updateSettings(kidId, updates) {
  const dbUpdates = {}
  if (updates.childName !== undefined) dbUpdates.name = updates.childName
  if (updates.allowanceAmount !== undefined) dbUpdates.allowance_amount = updates.allowanceAmount
  if (updates.deductionPerMissedChore !== undefined) dbUpdates.deduction_per_missed_chore = updates.deductionPerMissedChore
  if (updates.icalUrl !== undefined) dbUpdates.ical_url = updates.icalUrl
  const { data } = await supabase.from('kids').update(dbUpdates).eq('id', kidId).select().single()
  if (!data) return null
  return {
    childName: data.name,
    kidEmoji: data.emoji,
    allowanceAmount: Number(data.allowance_amount),
    deductionPerMissedChore: Number(data.deduction_per_missed_chore),
    icalUrl: data.ical_url
  }
}

// ── Family info ───────────────────────────────────────────────────────────────

async function getFamilyInfo(familyId) {
  const { data } = await supabase.from('families').select('invite_code, admin_pin').eq('id', familyId).single()
  return data ? { inviteCode: data.invite_code, adminPin: data.admin_pin } : null
}

async function updateFamilyInfo(familyId, updates) {
  const dbUpdates = {}
  if (updates.inviteCode !== undefined) dbUpdates.invite_code = updates.inviteCode
  if (updates.adminPin !== undefined) dbUpdates.admin_pin = updates.adminPin
  await supabase.from('families').update(dbUpdates).eq('id', familyId)
}

// ── Chores ────────────────────────────────────────────────────────────────────

async function getChoresRaw(kidId) {
  const { data } = await supabase.from('chores').select('*').eq('kid_id', kidId).single()
  if (!data) return null
  return {
    currentWeek: data.current_week,
    weekday: data.weekday,
    weekend: data.weekend,
    celebrationShown: data.celebration_shown,
    weekendCelebrationShown: data.weekend_celebration_shown,
    history: data.history || []
  }
}

async function writeChores(chores, kidId) {
  await supabase.from('chores').update({
    current_week: chores.currentWeek,
    weekday: chores.weekday,
    weekend: chores.weekend,
    celebration_shown: chores.celebrationShown,
    weekend_celebration_shown: chores.weekendCelebrationShown,
    history: chores.history
  }).eq('kid_id', kidId)
}

// ── Earnings ──────────────────────────────────────────────────────────────────

function calculateEarnings(chores, settings) {
  const deduction = settings.deductionPerMissedChore ?? 0.25
  const base = settings.allowanceAmount ?? 3
  const weekStart = new Date(chores.currentWeek)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const elapsedWeekdays = []
  for (let d = new Date(weekStart); d <= today; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) elapsedWeekdays.push(d.toISOString().split('T')[0])
  }

  const weekdayItems = chores.weekday.items
  const weekdayCompletions = chores.weekday.completions || {}
  const possibleWeekday = elapsedWeekdays.length * weekdayItems.length
  let actualWeekday = 0
  for (const day of elapsedWeekdays) {
    actualWeekday += (weekdayCompletions[day] || []).length
  }

  const activeWeekend = chores.weekend.active || []
  const weekendCompletions = chores.weekend.completions || {}
  const possibleWeekend = activeWeekend.length
  const actualWeekend = activeWeekend.filter(id => weekendCompletions[id]).length

  const totalPossible = possibleWeekday + possibleWeekend
  const totalActual = actualWeekday + actualWeekend
  const totalMissed = totalPossible - totalActual
  const earnings = Math.max(0, Math.round((base - totalMissed * deduction) * 100) / 100)

  return {
    earnings, totalPossible, totalActual, totalMissed,
    weekdayStats: { elapsedDays: elapsedWeekdays.length, possible: possibleWeekday, actual: actualWeekday },
    weekendStats: { possible: possibleWeekend, actual: actualWeekend }
  }
}

// ── Weekly reset ──────────────────────────────────────────────────────────────

async function checkAndResetChores(kidId) {
  const chores = await getChoresRaw(kidId)
  const settings = await getSettings(kidId)
  const currentWeek = getMondayKey()

  if (chores.currentWeek !== currentWeek) {
    const lastEarnings = calculateEarnings(chores, settings)
    if (!chores.history) chores.history = []
    chores.history.push({ week: chores.currentWeek, ...lastEarnings, archivedAt: new Date().toISOString() })
    if (chores.history.length > 10) chores.history = chores.history.slice(-10)

    if (chores.currentWeek !== '2000-01-01' && lastEarnings.earnings > 0) {
      const { data: balData } = await supabase.from('balance').select('*').eq('kid_id', kidId).single()
      if (balData) {
        const newBal = Math.round((Number(balData.balance) + lastEarnings.earnings) * 100) / 100
        const txs = [...(balData.transactions || [])]
        txs.push({
          id: `tx${Date.now()}`,
          type: 'earn',
          amount: lastEarnings.earnings,
          note: `Week of ${chores.currentWeek}`,
          date: new Date().toISOString().split('T')[0]
        })
        if (txs.length > 50) txs.splice(0, txs.length - 50)
        await supabase.from('balance').update({ balance: newBal, transactions: txs }).eq('kid_id', kidId)
      }
    }

    chores.weekday = { ...chores.weekday, completions: {} }
    chores.weekend = { ...chores.weekend, active: [], completions: {} }
    chores.currentWeek = currentWeek
    chores.celebrationShown = {}
    chores.weekendCelebrationShown = false
    await writeChores(chores, kidId)
  }
  return chores
}

// ── iCal ──────────────────────────────────────────────────────────────────────

let calendarCache = { events: [], lastFetched: 0, url: null }

async function fetchICalEvents(url) {
  if (!ical) return []
  try {
    const raw = await ical.async.fromURL(url)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 90)
    const results = []
    for (const key in raw) {
      const ev = raw[key]
      if (ev.type !== 'VEVENT' || !ev.start) continue
      if (ev.start < today || ev.start > cutoff) continue
      results.push({
        id: ev.uid || key,
        title: ev.summary || 'Event',
        date: ev.start.toISOString().split('T')[0],
        emoji: '📅',
        color: '#60A5FA',
        source: 'ical'
      })
    }
    return results.sort((a, b) => a.date.localeCompare(b.date))
  } catch (err) {
    console.error('iCal fetch error:', err.message)
    return []
  }
}

async function getICalEvents(icalUrl) {
  if (!icalUrl) return []
  const now = Date.now()
  if (calendarCache.url !== icalUrl || now - calendarCache.lastFetched > 30 * 60 * 1000) {
    const fetched = await fetchICalEvents(icalUrl)
    calendarCache = { events: fetched, lastFetched: now, url: icalUrl }
  }
  return calendarCache.events
}

module.exports = {
  getMondayKey,
  getTodayKey,
  getSettings,
  updateSettings,
  getFamilyInfo,
  updateFamilyInfo,
  getChoresRaw,
  writeChores,
  calculateEarnings,
  checkAndResetChores,
  getICalEvents
}
