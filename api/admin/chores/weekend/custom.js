const { getChoresRaw, writeChores } = require('../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await getChoresRaw()
  const newChore = { id: `we${Date.now()}`, name: req.body.name, emoji: req.body.emoji || '✅', temporary: true }
  chores.weekend.pool.push(newChore)
  chores.weekend.active.push(newChore.id)
  chores.weekend.completions[newChore.id] = false
  chores.weekendCelebrationShown = false
  await writeChores(chores)
  res.json(chores)
}
