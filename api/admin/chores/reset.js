const { getChoresRaw, writeChores, getMondayKey } = require('../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await getChoresRaw()
  chores.weekday = { ...chores.weekday, completions: {} }
  chores.weekend = { ...chores.weekend, active: [], completions: {} }
  chores.currentWeek = getMondayKey()
  chores.celebrationShown = {}
  chores.weekendCelebrationShown = false
  await writeChores(chores)
  res.json(chores)
}
