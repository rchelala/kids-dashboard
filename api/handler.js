const {
  getMondayKey, getTodayKey, getSettings, updateSettings,
  getChoresRaw, writeChores, calculateEarnings, checkAndResetChores, getICalEvents
} = require('./_lib/helpers')
const { supabase } = require('./_lib/supabase')

module.exports = async function handler(req, res) {
  const slug = (req.query.path || '').split('/').filter(Boolean)
  const path = slug.join('/')
  const method = req.method

  try {

    // POST /api/auth
    if (method === 'POST' && path === 'auth') {
      const { code } = req.body || {}
      if (!code) return res.status(400).json({ success: false })
      const settings = await getSettings()
      if (code === settings.adminPassword) return res.json({ success: true, role: 'admin' })
      const viewerCode = settings.viewerCode || 'ASHER2024'
      if (code === viewerCode) return res.json({ success: true, role: 'viewer' })
      return res.status(401).json({ success: false })
    }

    // GET /api/settings
    if (method === 'GET' && path === 'settings') {
      const settings = await getSettings()
      const { adminPassword: _, ...safe } = settings
      return res.json(safe)
    }

    // POST /api/admin/login
    if (method === 'POST' && path === 'admin/login') {
      const settings = await getSettings()
      if (req.body.password === settings.adminPassword) return res.json({ success: true })
      return res.status(401).json({ success: false, message: 'Wrong password' })
    }

    // PUT /api/admin/settings
    if (method === 'PUT' && path === 'admin/settings') {
      const settings = await getSettings()
      const updated = await updateSettings({ ...settings, ...req.body })
      return res.json(updated)
    }

    // GET /api/chores
    if (method === 'GET' && path === 'chores') {
      const chores = await checkAndResetChores()
      const settings = await getSettings()
      const earnings = calculateEarnings(chores, settings)
      const todayCompletions = chores.weekday.completions[getTodayKey()] || []
      return res.json({ ...chores, earnings, todayCompletions })
    }

    // POST /api/chores/weekday/:id/toggle
    if (method === 'POST' && slug[0] === 'chores' && slug[1] === 'weekday' && slug[3] === 'toggle') {
      const id = slug[2]
      const chores = await checkAndResetChores()
      const today = getTodayKey()
      if (!chores.weekday.completions[today]) chores.weekday.completions[today] = []
      const arr = chores.weekday.completions[today]
      const idx = arr.indexOf(id)
      if (idx === -1) arr.push(id)
      else arr.splice(idx, 1)
      await writeChores(chores)
      const settings = await getSettings()
      const earnings = calculateEarnings(chores, settings)
      return res.json({ ...chores, earnings, todayCompletions: arr })
    }

    // POST /api/chores/weekend/:id/toggle
    if (method === 'POST' && slug[0] === 'chores' && slug[1] === 'weekend' && slug[3] === 'toggle') {
      const id = slug[2]
      const chores = await checkAndResetChores()
      if (!chores.weekend.completions) chores.weekend.completions = {}
      chores.weekend.completions[id] = !chores.weekend.completions[id]
      await writeChores(chores)
      const settings = await getSettings()
      const earnings = calculateEarnings(chores, settings)
      const todayCompletions = chores.weekday.completions[getTodayKey()] || []
      return res.json({ ...chores, earnings, todayCompletions })
    }

    // POST /api/chores/celebration-shown
    if (method === 'POST' && path === 'chores/celebration-shown') {
      const chores = await getChoresRaw()
      const { type, date } = req.body
      if (type === 'weekend') {
        chores.weekendCelebrationShown = true
      } else {
        const key = date || getTodayKey()
        if (!chores.celebrationShown) chores.celebrationShown = {}
        chores.celebrationShown[key] = true
      }
      await writeChores(chores)
      return res.json({ success: true })
    }

    // GET /api/alarms
    if (method === 'GET' && path === 'alarms') {
      const { data } = await supabase.from('alarms').select('*').order('time')
      return res.json(data || [])
    }

    // POST /api/admin/alarms
    if (method === 'POST' && path === 'admin/alarms') {
      const newAlarm = {
        id: `al${Date.now()}`,
        time: req.body.time,
        label: req.body.label || 'Wake up!',
        days: req.body.days || ['mon', 'tue', 'wed', 'thu', 'fri'],
        enabled: true,
        sound: req.body.sound || 'rocket'
      }
      await supabase.from('alarms').insert(newAlarm)
      const { data } = await supabase.from('alarms').select('*').order('time')
      return res.json(data || [])
    }

    // PUT or DELETE /api/admin/alarms/:id
    if ((method === 'PUT' || method === 'DELETE') && slug[0] === 'admin' && slug[1] === 'alarms' && slug[2]) {
      if (method === 'PUT') await supabase.from('alarms').update(req.body).eq('id', slug[2])
      else await supabase.from('alarms').delete().eq('id', slug[2])
      const { data } = await supabase.from('alarms').select('*').order('time')
      return res.json(data || [])
    }

    // GET /api/calendar
    if (method === 'GET' && path === 'calendar') {
      const settings = await getSettings()
      const { data: localEvents } = await supabase.from('calendar_events').select('*').is('source', null)
      const icalEvents = await getICalEvents(settings.icalUrl)
      const all = [...(localEvents || []), ...icalEvents].sort((a, b) => a.date.localeCompare(b.date))
      return res.json(all)
    }

    // POST /api/admin/calendar
    if (method === 'POST' && path === 'admin/calendar') {
      const newEvent = {
        id: `ev${Date.now()}`,
        title: req.body.title,
        date: req.body.date,
        emoji: req.body.emoji || '📅',
        color: req.body.color || '#4ECDC4'
      }
      await supabase.from('calendar_events').insert(newEvent)
      const { data } = await supabase.from('calendar_events').select('*').is('source', null)
      return res.json(data || [])
    }

    // DELETE /api/admin/calendar/:id
    if (method === 'DELETE' && slug[0] === 'admin' && slug[1] === 'calendar' && slug[2]) {
      await supabase.from('calendar_events').delete().eq('id', slug[2])
      const { data } = await supabase.from('calendar_events').select('*').is('source', null)
      return res.json(data || [])
    }

    // GET /api/balance
    if (method === 'GET' && path === 'balance') {
      const { data } = await supabase.from('balance').select('*').eq('id', 1).single()
      return res.json(data ? { balance: Number(data.balance), transactions: data.transactions || [] } : { balance: 0, transactions: [] })
    }

    // POST /api/admin/balance/spend
    if (method === 'POST' && path === 'admin/balance/spend') {
      const amount = Math.round(Number(req.body.amount) * 100) / 100
      if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
      const { data } = await supabase.from('balance').select('*').eq('id', 1).single()
      const newBalance = Math.round((Number(data.balance) - amount) * 100) / 100
      const transactions = [...(data.transactions || []), {
        id: `tx${Date.now()}`, type: 'spend', amount,
        note: req.body.note || 'Purchase',
        date: new Date().toISOString().split('T')[0]
      }]
      if (transactions.length > 50) transactions.splice(0, transactions.length - 50)
      await supabase.from('balance').update({ balance: newBalance, transactions }).eq('id', 1)
      return res.json({ balance: newBalance, transactions })
    }

    // POST /api/admin/balance/adjust
    if (method === 'POST' && path === 'admin/balance/adjust') {
      const amount = Math.round(Number(req.body.amount) * 100) / 100
      if (isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' })
      const { data } = await supabase.from('balance').select('*').eq('id', 1).single()
      const newBalance = Math.round((Number(data.balance) + amount) * 100) / 100
      const transactions = [...(data.transactions || []), {
        id: `tx${Date.now()}`, type: 'adjust', amount,
        note: req.body.note || 'Manual adjustment',
        date: new Date().toISOString().split('T')[0]
      }]
      if (transactions.length > 50) transactions.splice(0, transactions.length - 50)
      await supabase.from('balance').update({ balance: newBalance, transactions }).eq('id', 1)
      return res.json({ balance: newBalance, transactions })
    }

    // POST /api/admin/chores/weekday (add)
    if (method === 'POST' && path === 'admin/chores/weekday') {
      const chores = await getChoresRaw()
      chores.weekday.items.push({ id: `wd${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
      await writeChores(chores)
      return res.json(chores)
    }

    // DELETE /api/admin/chores/weekday/:id
    if (method === 'DELETE' && slug[0] === 'admin' && slug[1] === 'chores' && slug[2] === 'weekday' && slug[3]) {
      const chores = await getChoresRaw()
      chores.weekday.items = chores.weekday.items.filter(c => c.id !== slug[3])
      await writeChores(chores)
      return res.json(chores)
    }

    // POST /api/admin/chores/reset
    if (method === 'POST' && path === 'admin/chores/reset') {
      const chores = await getChoresRaw()
      chores.weekday = { ...chores.weekday, completions: {} }
      chores.weekend = { ...chores.weekend, active: [], completions: {} }
      chores.currentWeek = getMondayKey()
      chores.celebrationShown = {}
      chores.weekendCelebrationShown = false
      await writeChores(chores)
      return res.json(chores)
    }

    // POST /api/admin/chores/weekend/pool
    if (method === 'POST' && path === 'admin/chores/weekend/pool') {
      const chores = await getChoresRaw()
      chores.weekend.pool.push({ id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
      await writeChores(chores)
      return res.json(chores)
    }

    // DELETE /api/admin/chores/weekend/pool/:id
    if (method === 'DELETE' && slug[0] === 'admin' && slug[1] === 'chores' && slug[2] === 'weekend' && slug[3] === 'pool' && slug[4]) {
      const chores = await getChoresRaw()
      const id = slug[4]
      chores.weekend.pool = chores.weekend.pool.filter(c => c.id !== id)
      chores.weekend.active = chores.weekend.active.filter(a => a !== id)
      if (chores.weekend.completions) delete chores.weekend.completions[id]
      await writeChores(chores)
      return res.json(chores)
    }

    // POST /api/admin/chores/weekend/activate
    if (method === 'POST' && path === 'admin/chores/weekend/activate') {
      const chores = await getChoresRaw()
      chores.weekend.active = req.body.active || []
      const newCompletions = {}
      for (const id of chores.weekend.active) {
        newCompletions[id] = chores.weekend.completions[id] || false
      }
      chores.weekend.completions = newCompletions
      chores.weekendCelebrationShown = false
      await writeChores(chores)
      return res.json(chores)
    }

    // POST /api/admin/chores/weekend/custom
    if (method === 'POST' && path === 'admin/chores/weekend/custom') {
      const chores = await getChoresRaw()
      const newChore = { id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅', temporary: true }
      chores.weekend.pool.push(newChore)
      chores.weekend.active.push(newChore.id)
      chores.weekend.completions[newChore.id] = false
      chores.weekendCelebrationShown = false
      await writeChores(chores)
      return res.json(chores)
    }

    res.status(404).json({ error: 'Not found' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
