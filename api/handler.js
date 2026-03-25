const {
  getMondayKey, getTodayKey, getSettings, updateSettings,
  getFamilyInfo, updateFamilyInfo,
  getChoresRaw, writeChores, calculateEarnings, checkAndResetChores, getICalEvents
} = require('./_lib/helpers')
const { supabase } = require('./_lib/supabase')

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getAuthContext(req) {
  const user = await getUser(req)
  if (!user) return null
  const { data: member } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single()
  const kidId = req.headers['x-kid-id'] || null
  const familyId = member?.family_id || null
  return { userId: user.id, kidId, familyId, role: member?.role }
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  const slug = (req.query.path || '').split('/').filter(Boolean)
  const path = slug.join('/')
  const method = req.method

  try {

    // ── ONBOARDING (JWT only, no family required) ─────────────────────────────

    // POST /api/families — create a new family + first kid
    if (method === 'POST' && path === 'families') {
      const user = await getUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })

      const { kidName, kidEmoji } = req.body
      if (!kidName) return res.status(400).json({ error: 'Kid name required' })

      // Generate a random 8-char invite code
      const inviteCode = Math.random().toString(36).substring(2, 6).toUpperCase() +
                         Math.random().toString(36).substring(2, 6).toUpperCase()

      const { data: family } = await supabase
        .from('families')
        .insert({ invite_code: inviteCode, admin_pin: '1234' })
        .select()
        .single()

      const { data: kid } = await supabase
        .from('kids')
        .insert({ family_id: family.id, name: kidName, emoji: kidEmoji || '⭐' })
        .select()
        .single()

      await supabase.from('family_members').insert({ family_id: family.id, user_id: user.id, role: 'owner' })

      // Seed empty chores and balance for the new kid
      await supabase.from('chores').insert({
        kid_id: kid.id,
        current_week: getMondayKey(),
        weekday: { items: [], completions: {} },
        weekend: { pool: [], active: [], completions: {} },
        celebration_shown: {},
        weekend_celebration_shown: false,
        history: []
      })
      await supabase.from('balance').insert({ kid_id: kid.id, balance: 0, transactions: [] })

      return res.json({ familyId: family.id, kid })
    }

    // POST /api/families/join — join an existing family via invite code
    if (method === 'POST' && path === 'families/join') {
      const user = await getUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })

      const { inviteCode } = req.body
      if (!inviteCode) return res.status(400).json({ error: 'Invite code required' })

      const { data: family } = await supabase
        .from('families')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (!family) return res.status(404).json({ error: 'Invalid invite code' })

      // Check not already a member
      const { data: existing } = await supabase
        .from('family_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('family_id', family.id)
        .single()

      if (!existing) {
        await supabase.from('family_members').insert({ family_id: family.id, user_id: user.id, role: 'member' })
      }

      return res.json({ familyId: family.id })
    }

    // ── AUTHENTICATED ENDPOINTS ───────────────────────────────────────────────

    const auth = await getAuthContext(req)
    if (!auth || !auth.userId) return res.status(401).json({ error: 'Unauthorized' })
    const { userId, kidId, familyId } = auth

    // GET /api/families/kids — kid list for picker
    if (method === 'GET' && path === 'families/kids') {
      if (!familyId) return res.status(403).json({ error: 'No family' })
      const { data } = await supabase.from('kids').select('*').eq('family_id', familyId).order('created_at')
      return res.json(data || [])
    }

    // POST /api/admin/login — verify admin PIN for the settings panel
    if (method === 'POST' && path === 'admin/login') {
      if (!familyId) return res.status(403).json({ error: 'No family' })
      const family = await getFamilyInfo(familyId)
      if (req.body.password === family.adminPin) return res.json({ success: true })
      return res.status(401).json({ success: false, message: 'Wrong PIN' })
    }

    // ── KID-SCOPED ENDPOINTS (require kidId) ──────────────────────────────────

    if (!kidId) return res.status(400).json({ error: 'x-kid-id header required' })
    if (!familyId) return res.status(403).json({ error: 'No family' })

    // Validate kidId belongs to this family
    const { data: kidRow } = await supabase
      .from('kids')
      .select('id')
      .eq('id', kidId)
      .eq('family_id', familyId)
      .single()
    if (!kidRow) return res.status(403).json({ error: 'Kid not in family' })

    // GET /api/settings
    if (method === 'GET' && path === 'settings') {
      const settings = await getSettings(kidId)
      const family = await getFamilyInfo(familyId)
      return res.json({ ...settings, inviteCode: family?.inviteCode })
    }

    // PUT /api/admin/settings
    if (method === 'PUT' && path === 'admin/settings') {
      const kidUpdates = {}
      const familyUpdates = {}
      if (req.body.childName !== undefined) kidUpdates.childName = req.body.childName
      if (req.body.allowanceAmount !== undefined) kidUpdates.allowanceAmount = Number(req.body.allowanceAmount)
      if (req.body.deductionPerMissedChore !== undefined) kidUpdates.deductionPerMissedChore = Number(req.body.deductionPerMissedChore)
      if (req.body.icalUrl !== undefined) kidUpdates.icalUrl = req.body.icalUrl
      if (req.body.inviteCode !== undefined) familyUpdates.inviteCode = req.body.inviteCode
      if (req.body.adminPin !== undefined) familyUpdates.adminPin = req.body.adminPin
      if (Object.keys(kidUpdates).length > 0) await updateSettings(kidId, kidUpdates)
      if (Object.keys(familyUpdates).length > 0) await updateFamilyInfo(familyId, familyUpdates)
      const updated = await getSettings(kidId)
      const family = await getFamilyInfo(familyId)
      return res.json({ ...updated, inviteCode: family?.inviteCode })
    }

    // GET /api/chores
    if (method === 'GET' && path === 'chores') {
      const chores = await checkAndResetChores(kidId)
      const settings = await getSettings(kidId)
      const earnings = calculateEarnings(chores, settings)
      const todayCompletions = chores.weekday.completions[getTodayKey()] || []
      return res.json({ ...chores, earnings, todayCompletions })
    }

    // POST /api/chores/weekday/:id/toggle
    if (method === 'POST' && slug[0] === 'chores' && slug[1] === 'weekday' && slug[3] === 'toggle') {
      const id = slug[2]
      const chores = await checkAndResetChores(kidId)
      const today = getTodayKey()
      if (!chores.weekday.completions[today]) chores.weekday.completions[today] = []
      const arr = chores.weekday.completions[today]
      const idx = arr.indexOf(id)
      if (idx === -1) arr.push(id)
      else arr.splice(idx, 1)
      await writeChores(chores, kidId)
      const settings = await getSettings(kidId)
      const earnings = calculateEarnings(chores, settings)
      return res.json({ ...chores, earnings, todayCompletions: arr })
    }

    // POST /api/chores/weekend/:id/toggle
    if (method === 'POST' && slug[0] === 'chores' && slug[1] === 'weekend' && slug[3] === 'toggle') {
      const id = slug[2]
      const chores = await checkAndResetChores(kidId)
      if (!chores.weekend.completions) chores.weekend.completions = {}
      chores.weekend.completions[id] = !chores.weekend.completions[id]
      await writeChores(chores, kidId)
      const settings = await getSettings(kidId)
      const earnings = calculateEarnings(chores, settings)
      const todayCompletions = chores.weekday.completions[getTodayKey()] || []
      return res.json({ ...chores, earnings, todayCompletions })
    }

    // POST /api/chores/celebration-shown
    if (method === 'POST' && path === 'chores/celebration-shown') {
      const chores = await getChoresRaw(kidId)
      const { type, date } = req.body
      if (type === 'weekend') {
        chores.weekendCelebrationShown = true
      } else {
        const key = date || getTodayKey()
        if (!chores.celebrationShown) chores.celebrationShown = {}
        chores.celebrationShown[key] = true
      }
      await writeChores(chores, kidId)
      return res.json({ success: true })
    }

    // GET /api/alarms
    if (method === 'GET' && path === 'alarms') {
      const { data } = await supabase.from('alarms').select('*').eq('kid_id', kidId).order('time')
      return res.json(data || [])
    }

    // POST /api/admin/alarms
    if (method === 'POST' && path === 'admin/alarms') {
      const newAlarm = {
        kid_id: kidId,
        id: `al${Date.now()}`,
        time: req.body.time,
        label: req.body.label || 'Wake up!',
        days: req.body.days || ['mon', 'tue', 'wed', 'thu', 'fri'],
        enabled: true,
        sound: req.body.sound || 'rocket'
      }
      await supabase.from('alarms').insert(newAlarm)
      const { data } = await supabase.from('alarms').select('*').eq('kid_id', kidId).order('time')
      return res.json(data || [])
    }

    // PUT or DELETE /api/admin/alarms/:id
    if ((method === 'PUT' || method === 'DELETE') && slug[0] === 'admin' && slug[1] === 'alarms' && slug[2]) {
      if (method === 'PUT') await supabase.from('alarms').update(req.body).eq('id', slug[2]).eq('kid_id', kidId)
      else await supabase.from('alarms').delete().eq('id', slug[2]).eq('kid_id', kidId)
      const { data } = await supabase.from('alarms').select('*').eq('kid_id', kidId).order('time')
      return res.json(data || [])
    }

    // GET /api/calendar
    if (method === 'GET' && path === 'calendar') {
      const settings = await getSettings(kidId)
      const { data: localEvents } = await supabase.from('calendar_events').select('*').eq('family_id', familyId).is('source', null)
      const icalEvents = await getICalEvents(settings.icalUrl)
      const all = [...(localEvents || []), ...icalEvents].sort((a, b) => a.date.localeCompare(b.date))
      return res.json(all)
    }

    // POST /api/admin/calendar
    if (method === 'POST' && path === 'admin/calendar') {
      const newEvent = {
        family_id: familyId,
        id: `ev${Date.now()}`,
        title: req.body.title,
        date: req.body.date,
        emoji: req.body.emoji || '📅',
        color: req.body.color || '#4ECDC4'
      }
      await supabase.from('calendar_events').insert(newEvent)
      const { data } = await supabase.from('calendar_events').select('*').eq('family_id', familyId).is('source', null)
      return res.json(data || [])
    }

    // DELETE /api/admin/calendar/:id
    if (method === 'DELETE' && slug[0] === 'admin' && slug[1] === 'calendar' && slug[2]) {
      await supabase.from('calendar_events').delete().eq('id', slug[2]).eq('family_id', familyId)
      const { data } = await supabase.from('calendar_events').select('*').eq('family_id', familyId).is('source', null)
      return res.json(data || [])
    }

    // GET /api/balance
    if (method === 'GET' && path === 'balance') {
      const { data } = await supabase.from('balance').select('*').eq('kid_id', kidId).single()
      return res.json(data ? { balance: Number(data.balance), transactions: data.transactions || [] } : { balance: 0, transactions: [] })
    }

    // POST /api/admin/balance/spend
    if (method === 'POST' && path === 'admin/balance/spend') {
      const amount = Math.round(Number(req.body.amount) * 100) / 100
      if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
      const { data } = await supabase.from('balance').select('*').eq('kid_id', kidId).single()
      const newBalance = Math.round((Number(data.balance) - amount) * 100) / 100
      const transactions = [...(data.transactions || []), {
        id: `tx${Date.now()}`, type: 'spend', amount,
        note: req.body.note || 'Purchase',
        date: new Date().toISOString().split('T')[0]
      }]
      if (transactions.length > 50) transactions.splice(0, transactions.length - 50)
      await supabase.from('balance').update({ balance: newBalance, transactions }).eq('kid_id', kidId)
      return res.json({ balance: newBalance, transactions })
    }

    // POST /api/admin/balance/adjust
    if (method === 'POST' && path === 'admin/balance/adjust') {
      const amount = Math.round(Number(req.body.amount) * 100) / 100
      if (isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' })
      const { data } = await supabase.from('balance').select('*').eq('kid_id', kidId).single()
      const newBalance = Math.round((Number(data.balance) + amount) * 100) / 100
      const transactions = [...(data.transactions || []), {
        id: `tx${Date.now()}`, type: 'adjust', amount,
        note: req.body.note || 'Manual adjustment',
        date: new Date().toISOString().split('T')[0]
      }]
      if (transactions.length > 50) transactions.splice(0, transactions.length - 50)
      await supabase.from('balance').update({ balance: newBalance, transactions }).eq('kid_id', kidId)
      return res.json({ balance: newBalance, transactions })
    }

    // POST /api/admin/chores/weekday
    if (method === 'POST' && path === 'admin/chores/weekday') {
      const chores = await getChoresRaw(kidId)
      chores.weekday.items.push({ id: `wd${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    // DELETE /api/admin/chores/weekday/:id
    if (method === 'DELETE' && slug[0] === 'admin' && slug[1] === 'chores' && slug[2] === 'weekday' && slug[3]) {
      const chores = await getChoresRaw(kidId)
      chores.weekday.items = chores.weekday.items.filter(c => c.id !== slug[3])
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    // POST /api/admin/chores/reset
    if (method === 'POST' && path === 'admin/chores/reset') {
      const chores = await getChoresRaw(kidId)
      chores.weekday = { ...chores.weekday, completions: {} }
      chores.weekend = { ...chores.weekend, active: [], completions: {} }
      chores.currentWeek = getMondayKey()
      chores.celebrationShown = {}
      chores.weekendCelebrationShown = false
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    // POST /api/admin/chores/weekend/pool
    if (method === 'POST' && path === 'admin/chores/weekend/pool') {
      const chores = await getChoresRaw(kidId)
      chores.weekend.pool.push({ id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    // DELETE /api/admin/chores/weekend/pool/:id
    if (method === 'DELETE' && slug[0] === 'admin' && slug[1] === 'chores' && slug[2] === 'weekend' && slug[3] === 'pool' && slug[4]) {
      const chores = await getChoresRaw(kidId)
      const id = slug[4]
      chores.weekend.pool = chores.weekend.pool.filter(c => c.id !== id)
      chores.weekend.active = chores.weekend.active.filter(a => a !== id)
      if (chores.weekend.completions) delete chores.weekend.completions[id]
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    // POST /api/admin/chores/weekend/activate
    if (method === 'POST' && path === 'admin/chores/weekend/activate') {
      const chores = await getChoresRaw(kidId)
      chores.weekend.active = req.body.active || []
      const newCompletions = {}
      for (const id of chores.weekend.active) {
        newCompletions[id] = chores.weekend.completions[id] || false
      }
      chores.weekend.completions = newCompletions
      chores.weekendCelebrationShown = false
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    // POST /api/admin/chores/weekend/custom
    if (method === 'POST' && path === 'admin/chores/weekend/custom') {
      const chores = await getChoresRaw(kidId)
      const newChore = { id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅', temporary: true }
      chores.weekend.pool.push(newChore)
      chores.weekend.active.push(newChore.id)
      chores.weekend.completions[newChore.id] = false
      chores.weekendCelebrationShown = false
      await writeChores(chores, kidId)
      return res.json(chores)
    }

    res.status(404).json({ error: 'Not found' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
