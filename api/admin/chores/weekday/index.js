const { getChoresRaw, writeChores } = require('../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await getChoresRaw()
  chores.weekday.items.push({ id: `wd${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅' })
  await writeChores(chores)
  res.json(chores)
}
