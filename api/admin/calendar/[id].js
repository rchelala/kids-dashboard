const { supabase } = require('../../_lib/supabase')

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()
  await supabase.from('calendar_events').delete().eq('id', req.query.id)
  const { data } = await supabase.from('calendar_events').select('*').is('source', null)
  res.json(data || [])
}
