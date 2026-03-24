const { getChoresRaw, writeChores } = require('../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await getChoresRaw()
  chores.weekend.active = req.body.active || []
  const newCompletions = {}
  for (const id of chores.weekend.active) {
    newCompletions[id] = chores.weekend.completions[id] || false
  }
  chores.weekend.completions = newCompletions
  chores.weekendCelebrationShown = false
  await writeChores(chores)
  res.json(chores)
}
