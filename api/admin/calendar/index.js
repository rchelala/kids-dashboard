const { supabase } = require('../../_lib/supabase')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const newEvent = {
    id: `ev${Date.now()}`,
    title: req.body.title,
    date: req.body.date,
    emoji: req.body.emoji || '📅',
    color: req.body.color || '#4ECDC4'
  }
  await supabase.from('calendar_events').insert(newEvent)
  const { data } = await supabase.from('calendar_events').select('*').is('source', null)
  res.json(data || [])
}
