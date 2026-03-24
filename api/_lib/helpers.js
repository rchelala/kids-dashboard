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

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (!data) return null
  return {
    childName: data.child_name,
    adminPassword: data.admin_password,
    allowanceAmount: Number(data.allowance_amount),
    deductionPerMissedChore: Number(data.deduction_per_missed_chore),
    weekStartDay: data.week_start_day,
    icalUrl: data.ical_url,
    viewerCode: data.viewer_code || 'ASHER2024'
  }
}

async function updateSettings(updates) {
  const dbUpdates = {}
  if (updates.childName !== undefined) dbUpdates.child_name = updates.childName
  if (updates.adminPassword !== undefined) dbUpdates.admin_password = updates.adminPassword
  if (updates.allowanceAmount !== undefined) dbUpdates.allowance_amount = updates.allowanceAmount
  if (updates.deductionPerMissedChore !== undefined) dbUpdates.deduction_per_missed_chore = updates.deductionPerMissedChore
  if (updates.weekStartDay !== undefined) dbUpdates.week_start_day = updates.weekStartDay
  if (updates.icalUrl !== undefined) dbUpdates.ical_url = updates.icalUrl
  if (updates.viewerCode !== undefined) dbUpdates.viewer_code = updates.viewerCode
  const { data } = await supabase.from('settings').update(dbUpdates).eq('id', 1).select().single()
  if (!data) return null
  return {
    childName: data.child_name,
    allowanceAmount: Number(data.allowance_amount),
    deductionPerMissedChore: Number(data.deduction_per_missed_chore),
    weekStartDay: data.week_start_day,
    icalUrl: data.ical_url
  }
}

// ── Chores ────────────────────────────────────────────────────────────────────

async function getChoresRaw() {
  const { data } = await supabase.from('chores').select('*').eq('id', 1).single()
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

async function writeChores(chores) {
  await supabase.from('chores').update({
    current_week: chores.currentWeek,
    weekday: chores.weekday,
    weekend: chores.weekend,
    celebration_shown: chores.celebrationShown,
    weekend_celebration_shown: chores.weekendCelebrationShown,
    history: chores.history
  }).eq('id', 1)
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

async function checkAndResetChores() {
  const chores = await getChoresRaw()
  const settings = await getSettings()
  const currentWeek = getMondayKey()

  if (chores.currentWeek !== currentWeek) {
    const lastEarnings = calculateEarnings(chores, settings)
    if (!chores.history) chores.history = []
    chores.history.push({ week: chores.currentWeek, ...lastEarnings, archivedAt: new Date().toISOString() })
    if (chores.history.length > 10) chores.history = chores.history.slice(-10)

    if (chores.currentWeek !== '2000-01-01' && lastEarnings.earnings > 0) {
      const { data: balData } = await supabase.from('balance').select('*').eq('id', 1).single()
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
        await supabase.from('balance').update({ balance: newBal, transactions: txs }).eq('id', 1)
      }
    }

    chores.weekday = { ...chores.weekday, completions: {} }
    chores.weekend = { ...chores.weekend, active: [], completions: {} }
    chores.currentWeek = currentWeek
    chores.celebrationShown = {}
    chores.weekendCelebrationShown = false
    await writeChores(chores)
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
  getChoresRaw,
  writeChores,
  calculateEarnings,
  checkAndResetChores,
  getICalEvents
}
