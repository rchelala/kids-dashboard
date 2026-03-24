const { supabase } = require('./_lib/supabase')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { data } = await supabase.from('balance').select('*').eq('id', 1).single()
  res.json(data ? { balance: Number(data.balance), transactions: data.transactions || [] } : { balance: 0, transactions: [] })
}
