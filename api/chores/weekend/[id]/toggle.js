const { checkAndResetChores, getSettings, calculateEarnings, writeChores, getTodayKey } = require('../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await checkAndResetChores()
  if (!chores.weekend.completions) chores.weekend.completions = {}
  chores.weekend.completions[req.query.id] = !chores.weekend.completions[req.query.id]
  await writeChores(chores)
  const settings = await getSettings()
  const earnings = calculateEarnings(chores, settings)
  const todayCompletions = chores.weekday.completions[getTodayKey()] || []
  res.json({ ...chores, earnings, todayCompletions })
}
