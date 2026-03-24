const { supabase } = require('./_lib/supabase')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { data } = await supabase.from('alarms').select('*').order('time')
  res.json(data || [])
}
