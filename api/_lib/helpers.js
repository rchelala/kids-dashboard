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
    starsPerDay: Number(data.stars_per_day ?? 5),
    icalUrl: data.ical_url,
    rewardDescription: data.reward_description || ''
  }
}

async function updateSettings(kidId, updates) {
  const dbUpdates = {}
  if (updates.childName !== undefined) dbUpdates.name = updates.childName
  if (updates.allowanceAmount !== undefined) dbUpdates.allowance_amount = updates.allowanceAmount
  if (updates.deductionPerMissedChore !== undefined) dbUpdates.deduction_per_missed_chore = updates.deductionPerMissedChore
  if (updates.starsPerDay !== undefined) dbUpdates.stars_per_day = updates.starsPerDay
  if (updates.icalUrl !== undefined) dbUpdates.ical_url = updates.icalUrl
  if (updates.rewardDescription !== undefined) dbUpdates.reward_description = updates.rewardDescription
  const { data } = await supabase.from('kids').update(dbUpdates).eq('id', kidId).select().single()
  if (!data) return null
  return {
    childName: data.name,
    kidEmoji: data.emoji,
    allowanceAmount: Number(data.allowance_amount),
    deductionPerMissedChore: Number(data.deduction_per_missed_chore),
    starsPerDay: Number(data.stars_per_day ?? 5),
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

// ── Stars ─────────────────────────────────────────────────────────────────────

// Stars for the CURRENT week, derived fresh from chore state on every call.
//
// Stars are never incremented by a toggle handler. Incrementing a counter on
// toggle would double-credit on uncheck/recheck and race the kiosk's 5-minute
// poll. Deriving instead makes the computation idempotent: unchecking a chore
// that breaks a completed day simply removes those stars, no compensating
// bookkeeping required. The only stars ever *written* are banked at the weekly
// rollover in checkAndResetChores(), which runs exactly once per week.
//
// Earning is all-or-nothing per day: a partial day earns nothing.
function computeWeekStars(chores, settings) {
  const starsPerDay = Number(settings?.starsPerDay ?? 5)
  const weekStart = new Date(chores.currentWeek)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const weekdayItems = chores.weekday?.items || []
  const weekdayCompletions = chores.weekday?.completions || {}

  let completedDays = 0
  if (weekdayItems.length > 0) {
    for (let d = new Date(weekStart); d <= today; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().split('T')[0]
      const done = weekdayCompletions[day] || []
      if (weekdayItems.every(item => done.includes(item.id))) completedDays++
    }
  }

  // The weekend list has no per-day structure — it's one active set with a
  // boolean completion map — so the whole set counts as a single "day".
  const activeWeekend = chores.weekend?.active || []
  const weekendCompletions = chores.weekend?.completions || {}
  if (activeWeekend.length > 0 && activeWeekend.every(id => weekendCompletions[id])) {
    completedDays++
  }

  return { stars: completedDays * starsPerDay, completedDays, starsPerDay }
}

// The kid's live star position: banked (from past weeks) + this week's derived
// stars, less what's been spent. Because the current week is derived rather
// than counted, this is always consistent with what's on screen.
//
// `balance` may go negative if a kid redeems and then unchecks a chore that
// breaks a completed day. That's kept honest here and clamped only for display;
// it self-heals as soon as the day is completed again.
async function starsFor(kidId, chores, settings) {
  const { data } = await supabase
    .from('balance')
    .select('stars_banked, stars_spent, star_transactions')
    .eq('kid_id', kidId)
    .single()

  const banked = Number(data?.stars_banked || 0)
  const spent = Number(data?.stars_spent || 0)
  const week = computeWeekStars(chores, settings)
  const earned = banked + week.stars

  return {
    balance: earned - spent,
    earned,
    banked,
    spent,
    thisWeek: week.stars,
    completedDays: week.completedDays,
    starsPerDay: week.starsPerDay,
    transactions: data?.star_transactions || []
  }
}

// ── Weekly reset ──────────────────────────────────────────────────────────────

async function checkAndResetChores(kidId) {
  const chores = await getChoresRaw(kidId)
  const settings = await getSettings(kidId)
  const currentWeek = getMondayKey()

  if (chores.currentWeek !== currentWeek) {
    const lastEarnings = calculateEarnings(chores, settings)
    const lastStars = computeWeekStars(chores, settings)

    // Bank the outgoing week's stars before the completions that derive them
    // are wiped. This branch is the once-per-week guard, so it cannot double-bank.
    if (lastStars.stars > 0) {
      const { data: bal } = await supabase.from('balance').select('stars_banked').eq('kid_id', kidId).single()
      const banked = Number(bal?.stars_banked || 0) + lastStars.stars
      await supabase.from('balance').update({ stars_banked: banked }).eq('kid_id', kidId)
    }

    if (!chores.history) chores.history = []
    chores.history.push({ week: chores.currentWeek, ...lastEarnings, stars: lastStars.stars, archivedAt: new Date().toISOString() })
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
  computeWeekStars,
  starsFor,
  checkAndResetChores,
  getICalEvents
}
