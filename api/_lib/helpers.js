const { supabase } = require('./supabase')

let ical = null
try { ical = require('node-ical') } catch (_) {}

// ── Date helpers ──────────────────────────────────────────────────────────────

// Arizona is UTC-7 year-round (no daylight saving time)
function getArizonaDate() {
  return new Date(Date.now() - 7 * 60 * 60 * 1000)
}

function getMondayKey() {
  const now = getArizonaDate()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setUTCDate(now.getUTCDate() + diff)
  return now.toISOString().split('T')[0]
}

function getTodayKey() {
  return getArizonaDate().toISOString().split('T')[0]
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
    icalUrl: data.ical_url,
    rewardDescription: data.reward_description || ''
  }
}

async function updateSettings(kidId, updates) {
  const dbUpdates = {}
  if (updates.childName !== undefined) dbUpdates.name = updates.childName
  if (updates.allowanceAmount !== undefined) dbUpdates.allowance_amount = updates.allowanceAmount
  if (updates.deductionPerMissedChore !== undefined) dbUpdates.deduction_per_missed_chore = updates.deductionPerMissedChore
  if (updates.icalUrl !== undefined) dbUpdates.ical_url = updates.icalUrl
  if (updates.rewardDescription !== undefined) dbUpdates.reward_description = updates.rewardDescription
  const { data } = await supabase.from('kids').update(dbUpdates).eq('id', kidId).select().single()
  if (!data) return null
  return {
    childName: data.name,
    kidEmoji: data.emoji,
    allowanceAmount: Number(data.allowance_amount),
    deductionPerMissedChore: Number(data.deduction_per_missed_chore),
    icalUrl: data.ical_url,
    rewardDescription: data.reward_description || ''
  }
}

// ── Family info ───────────────────────────────────────────────────────────────

async function getFamilyInfo(familyId) {
  const { data } = await supabase.from('families').select('invite_code, admin_pin, daily_message').eq('id', familyId).single()
  return data ? { inviteCode: data.invite_code, adminPin: data.admin_pin, dailyMessage: data.daily_message || '' } : null
}

async function updateFamilyInfo(familyId, updates) {
  const dbUpdates = {}
  if (updates.inviteCode !== undefined) dbUpdates.invite_code = updates.inviteCode
  if (updates.adminPin !== undefined) dbUpdates.admin_pin = updates.adminPin
  if (updates.dailyMessage !== undefined) dbUpdates.daily_message = updates.dailyMessage
  await supabase.from('families').update(dbUpdates).eq('id', familyId)
}

// ── Chores ────────────────────────────────────────────────────────────────────

async function getChoresRaw(kidId) {
  // Use select() without .single() so multiple duplicate rows don't cause a failure
  const { data: rows } = await supabase.from('chores').select('*').eq('kid_id', kidId)
  let data = rows?.[0] || null
  if (!data) {
    // Auto-seed missing chores row
    const { data: seeded, error: seedError } = await supabase.from('chores').insert({
      kid_id: kidId,
      current_week: getMondayKey(),
      weekday: { items: [], completions: {} },
      weekend: { pool: [], active: [], completions: {} },
      celebration_shown: {},
      weekend_celebration_shown: false,
      history: []
    }).select().single()
    if (seedError) throw seedError
    data = seeded
  }
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
  const payload = {
    current_week: chores.currentWeek,
    weekday: chores.weekday,
    weekend: chores.weekend,
    celebration_shown: chores.celebrationShown,
    weekend_celebration_shown: chores.weekendCelebrationShown,
    history: chores.history
  }
  const { data: rows, error } = await supabase.from('chores').update(payload).eq('kid_id', kidId).select('kid_id')
  if (error) throw error
  if (!rows || rows.length === 0) {
    const { error: ie } = await supabase.from('chores').insert({ kid_id: kidId, ...payload })
    if (ie) throw ie
  }
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
    elapsedWeekdays.push(d.toISOString().split('T')[0])
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
