const { supabase } = require('../../_lib/supabase')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const amount = Math.round(Number(req.body.amount) * 100) / 100
  if (isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' })
  const { data } = await supabase.from('balance').select('*').eq('id', 1).single()
  const newBalance = Math.round((Number(data.balance) + amount) * 100) / 100
  const transactions = [...(data.transactions || []), {
    id: `tx${Date.now()}`,
    type: 'adjust',
    amount,
    note: req.body.note || 'Manual adjustment',
    date: new Date().toISOString().split('T')[0]
  }]
  if (transactions.length > 50) transactions.splice(0, transactions.length - 50)
  await supabase.from('balance').update({ balance: newBalance, transactions }).eq('id', 1)
  res.json({ balance: newBalance, transactions })
}
