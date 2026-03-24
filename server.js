const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001
const DATA_DIR = path.join(__dirname, 'data')

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'dist')))

// Try to load node-ical (optional - only needed for iCal sync)
let ical = null
try { ical = require('node-ical') } catch (_) {}

// ─── Default data ────────────────────────────────────────────────────────────

const DEFAULTS = {
  'settings.json': {
    childName: 'Asher',
    adminPassword: 'Glowworm1014!',
    allowanceAmount: 3,
    deductionPerMissedChore: 0.25,
    weekStartDay: 'monday',
    icalUrl: null
  },
  'chores.json': {
    currentWeek: '2000-01-01',
    weekday: {
      items: [
        { id: 'wd1', name: 'Clean Room', emoji: '🛏️' },
        { id: 'wd2', name: 'Pick Up Dog Poop', emoji: '💩' },
        { id: 'wd3', name: 'Feed Animals', emoji: '🐾' }
      ],
      completions: {}
    },
    weekend: {
      pool: [],
      active: [],
      completions: {}
    },
    celebrationShown: {},
    weekendCelebrationShown: false,
    history: []
  },
  'alarms.json': [
    {
      id: 'al1',
      time: '06:00',
      label: 'Wake up, Asher!',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      enabled: true,
      sound: 'rocket'
    }
  ],
  'calendar.json': [],
  'balance.json': {
    balance: 35.00,
    transactions: [{ id: 'tx0', type: 'adjust', amount: 35, note: 'Starting balance', date: '2026-03-24' }]
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  for (const [filename, defaultData] of Object.entries(DEFAULTS)) {
    const filepath = path.join(DATA_DIR, filename)
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2))
    }
  }
}

function readData(filename) {
  const filepath = path.join(DATA_DIR, filename)
  return JSON.parse(fs.readFileSync(filepath, 'utf8'))
}

function writeData(filename, data) {
  const filepath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

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

// Calculate projected earnings for the current week so far
function calculateEarnings(chores, settings) {
  const deduction = settings.deductionPerMissedChore ?? 0.25
  const base = settings.allowanceAmount ?? 3
  const weekStart = new Date(chores.currentWeek)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  // Collect elapsed weekdays (Mon–Fri) up to today
  const elapsedWeekdays = []
  for (let d = new Date(weekStart); d <= today; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) {
      elapsedWeekdays.push(d.toISOString().split('T')[0])
    }
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
    earnings,
    totalPossible,
    totalActual,
    totalMissed,
    weekdayStats: { elapsedDays: elapsedWeekdays.length, possible: possibleWeekday, actual: actualWeekday },
    weekendStats: { possible: possibleWeekend, actual: actualWeekend }
  }
}

// Reset chores if a new week has started
function checkAndResetChores() {
  const chores = readData('chores.json')
  const settings = readData('settings.json')
  const currentWeek = getMondayKey()

  if (chores.currentWeek !== currentWeek) {
    const lastEarnings = calculateEarnings(chores, settings)
    if (!chores.history) chores.history = []
    chores.history.push({ week: chores.currentWeek, ...lastEarnings, archivedAt: new Date().toISOString() })
    if (chores.history.length > 10) chores.history = chores.history.slice(-10)

    // Auto-credit balance with last week's earnings (skip the dummy initial week)
    if (chores.currentWeek !== '2000-01-01' && lastEarnings.earnings > 0) {
      const balance = readData('balance.json')
      balance.balance = Math.round((balance.balance + lastEarnings.earnings) * 100) / 100
      balance.transactions.push({
        id: `tx${Date.now()}`,
        type: 'earn',
        amount: lastEarnings.earnings,
        note: `Week of ${chores.currentWeek}`,
        date: new Date().toISOString().split('T')[0]
      })
      if (balance.transactions.length > 50) balance.transactions = balance.transactions.slice(-50)
      writeData('balance.json', balance)
    }

    chores.weekday.completions = {}
    chores.weekend.active = []
    chores.weekend.completions = {}
    chores.currentWeek = currentWeek
    chores.celebrationShown = {}
    chores.weekendCelebrationShown = false
    writeData('chores.json', chores)
  }
  return chores
}

// ─── iCal cache ──────────────────────────────────────────────────────────────

let calendarCache = { events: [], lastFetched: 0, url: null }

async function fetchICalEvents(url) {
  if (!ical) return []
  try {
    const raw = await ical.async.fromURL(url)
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0) // Start of today — don't filter out today's events
    const cutoff = new Date(now)
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

// ─── Routes ──────────────────────────────────────────────────────────────────

// Settings
app.get('/api/settings', (req, res) => {
  const { adminPassword: _, ...safe } = readData('settings.json')
  res.json(safe)
})

app.post('/api/admin/login', (req, res) => {
  const settings = readData('settings.json')
  if (req.body.password === settings.adminPassword) {
    res.json({ success: true })
  } else {
    res.status(401).json({ success: false, message: 'Wrong password' })
  }
})

app.put('/api/admin/settings', (req, res) => {
  const settings = readData('settings.json')
  const updated = { ...settings, ...req.body }
  writeData('settings.json', updated)
  const { adminPassword: _, ...safe } = updated
  res.json(safe)
})

// ── Chores ────────────────────────────────────────────────────────────────────

app.get('/api/chores', (req, res) => {
  const chores = checkAndResetChores()
  const settings = readData('settings.json')
  const earnings = calculateEarnings(chores, settings)
  const todayCompletions = chores.weekday.completions[getTodayKey()] || []
  res.json({ ...chores, earnings, todayCompletions })
})

// Toggle a weekday chore for today
app.post('/api/chores/weekday/:id/toggle', (req, res) => {
  const chores = checkAndResetChores()
  const today = getTodayKey()
  if (!chores.weekday.completions[today]) chores.weekday.completions[today] = []
  const arr = chores.weekday.completions[today]
  const idx = arr.indexOf(req.params.id)
  if (idx === -1) arr.push(req.params.id)
  else arr.splice(idx, 1)
  writeData('chores.json', chores)
  const settings = readData('settings.json')
  const earnings = calculateEarnings(chores, settings)
  res.json({ ...chores, earnings, todayCompletions: arr })
})

// Toggle a weekend chore
app.post('/api/chores/weekend/:id/toggle', (req, res) => {
  const chores = checkAndResetChores()
  if (!chores.weekend.completions) chores.weekend.completions = {}
  chores.weekend.completions[req.params.id] = !chores.weekend.completions[req.params.id]
  writeData('chores.json', chores)
  const settings = readData('settings.json')
  const earnings = calculateEarnings(chores, settings)
  const todayCompletions = chores.weekday.completions[getTodayKey()] || []
  res.json({ ...chores, earnings, todayCompletions })
})

// Mark celebration shown
app.post('/api/chores/celebration-shown', (req, res) => {
  const chores = readData('chores.json')
  const { type, date } = req.body
  if (type === 'weekend') {
    chores.weekendCelebrationShown = true
  } else {
    const key = date || getTodayKey()
    if (!chores.celebrationShown) chores.celebrationShown = {}
    chores.celebrationShown[key] = true
  }
  writeData('chores.json', chores)
  res.json({ success: true })
})

// Admin: weekday chore management
app.post('/api/admin/chores/weekday', (req, res) => {
  const chores = readData('chores.json')
  chores.weekday.items.push({ id: `wd${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
  writeData('chores.json', chores)
  res.json(chores)
})

app.delete('/api/admin/chores/weekday/:id', (req, res) => {
  const chores = readData('chores.json')
  chores.weekday.items = chores.weekday.items.filter(c => c.id !== req.params.id)
  writeData('chores.json', chores)
  res.json(chores)
})

// Admin: weekend pool management
app.post('/api/admin/chores/weekend/pool', (req, res) => {
  const chores = readData('chores.json')
  chores.weekend.pool.push({ id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
  writeData('chores.json', chores)
  res.json(chores)
})

app.delete('/api/admin/chores/weekend/pool/:id', (req, res) => {
  const chores = readData('chores.json')
  chores.weekend.pool = chores.weekend.pool.filter(c => c.id !== req.params.id)
  chores.weekend.active = chores.weekend.active.filter(id => id !== req.params.id)
  delete chores.weekend.completions[req.params.id]
  writeData('chores.json', chores)
  res.json(chores)
})

// Admin: set which pool chores are active this weekend
app.post('/api/admin/chores/weekend/activate', (req, res) => {
  const chores = readData('chores.json')
  chores.weekend.active = req.body.active || []
  // Preserve existing completions, remove orphans
  const newCompletions = {}
  for (const id of chores.weekend.active) {
    newCompletions[id] = chores.weekend.completions[id] || false
  }
  chores.weekend.completions = newCompletions
  chores.weekendCelebrationShown = false
  writeData('chores.json', chores)
  res.json(chores)
})

// Admin: add a custom one-off weekend chore (adds to pool + activates immediately)
app.post('/api/admin/chores/weekend/custom', (req, res) => {
  const chores = readData('chores.json')
  const newChore = { id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅', temporary: true }
  chores.weekend.pool.push(newChore)
  chores.weekend.active.push(newChore.id)
  chores.weekend.completions[newChore.id] = false
  chores.weekendCelebrationShown = false
  writeData('chores.json', chores)
  res.json(chores)
})

// Admin: manual week reset
app.post('/api/admin/chores/reset', (req, res) => {
  const chores = readData('chores.json')
  chores.weekday.completions = {}
  chores.weekend.active = []
  chores.weekend.completions = {}
  chores.currentWeek = getMondayKey()
  chores.celebrationShown = {}
  chores.weekendCelebrationShown = false
  writeData('chores.json', chores)
  res.json(chores)
})

// ── Alarms ────────────────────────────────────────────────────────────────────

app.get('/api/alarms', (req, res) => {
  res.json(readData('alarms.json'))
})

app.post('/api/admin/alarms', (req, res) => {
  const alarms = readData('alarms.json')
  alarms.push({
    id: `al${Date.now()}`,
    time: req.body.time,
    label: req.body.label || 'Wake up!',
    days: req.body.days || ['mon', 'tue', 'wed', 'thu', 'fri'],
    enabled: true,
    sound: req.body.sound || 'rocket'
  })
  writeData('alarms.json', alarms)
  res.json(alarms)
})

app.put('/api/admin/alarms/:id', (req, res) => {
  const alarms = readData('alarms.json')
  const idx = alarms.findIndex(a => a.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  alarms[idx] = { ...alarms[idx], ...req.body }
  writeData('alarms.json', alarms)
  res.json(alarms)
})

app.delete('/api/admin/alarms/:id', (req, res) => {
  const alarms = readData('alarms.json')
  writeData('alarms.json', alarms.filter(a => a.id !== req.params.id))
  res.json(readData('alarms.json'))
})

// ── Calendar ──────────────────────────────────────────────────────────────────

app.get('/api/calendar', async (req, res) => {
  const settings = readData('settings.json')
  const localEvents = readData('calendar.json') || []
  let icalEvents = []

  if (settings.icalUrl) {
    const now = Date.now()
    const urlChanged = calendarCache.url !== settings.icalUrl
    if (urlChanged || now - calendarCache.lastFetched > 30 * 60 * 1000) {
      const fetched = await fetchICalEvents(settings.icalUrl)
      calendarCache = { events: fetched, lastFetched: now, url: settings.icalUrl }
    }
    icalEvents = calendarCache.events
  }

  const all = [...localEvents, ...icalEvents].sort((a, b) => a.date.localeCompare(b.date))
  res.json(all)
})

app.post('/api/admin/calendar', (req, res) => {
  const events = readData('calendar.json')
  events.push({
    id: `ev${Date.now()}`,
    title: req.body.title,
    date: req.body.date,
    emoji: req.body.emoji || '📅',
    color: req.body.color || '#4ECDC4'
  })
  writeData('calendar.json', events)
  res.json(events)
})

app.delete('/api/admin/calendar/:id', (req, res) => {
  const events = readData('calendar.json')
  writeData('calendar.json', events.filter(e => e.id !== req.params.id))
  res.json(readData('calendar.json'))
})

// ── Balance / Piggy Bank ──────────────────────────────────────────────────────

app.get('/api/balance', (req, res) => {
  res.json(readData('balance.json'))
})

// Log a purchase (deduct from balance)
app.post('/api/admin/balance/spend', (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100) / 100
  if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
  const balance = readData('balance.json')
  balance.balance = Math.round((balance.balance - amount) * 100) / 100
  balance.transactions.push({
    id: `tx${Date.now()}`,
    type: 'spend',
    amount,
    note: req.body.note || 'Purchase',
    date: new Date().toISOString().split('T')[0]
  })
  if (balance.transactions.length > 50) balance.transactions = balance.transactions.slice(-50)
  writeData('balance.json', balance)
  res.json(balance)
})

// Manual adjustment (positive or negative)
app.post('/api/admin/balance/adjust', (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100) / 100
  if (isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' })
  const balance = readData('balance.json')
  balance.balance = Math.round((balance.balance + amount) * 100) / 100
  balance.transactions.push({
    id: `tx${Date.now()}`,
    type: 'adjust',
    amount,
    note: req.body.note || 'Manual adjustment',
    date: new Date().toISOString().split('T')[0]
  })
  if (balance.transactions.length > 50) balance.transactions = balance.transactions.slice(-50)
  writeData('balance.json', balance)
  res.json(balance)
})

// ── Serve React app ───────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// ── Start ─────────────────────────────────────────────────────────────────────

ensureDataDir()
app.listen(PORT, () => {
  console.log(`\n🚀 Asher's Dashboard running at http://localhost:${PORT}\n`)
})
