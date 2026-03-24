const { supabase } = require('../../_lib/supabase')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
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
  res.json(data || [])
}
