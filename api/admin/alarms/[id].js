const { supabase } = require('../../_lib/supabase')

module.exports = async function handler(req, res) {
  const { id } = req.query
  if (req.method === 'PUT') {
    await supabase.from('alarms').update(req.body).eq('id', id)
    const { data } = await supabase.from('alarms').select('*').order('time')
    return res.json(data || [])
  }
  if (req.method === 'DELETE') {
    await supabase.from('alarms').delete().eq('id', id)
    const { data } = await supabase.from('alarms').select('*').order('time')
    return res.json(data || [])
  }
  res.status(405).end()
}
