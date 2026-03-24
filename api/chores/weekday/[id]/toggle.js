const { checkAndResetChores, getSettings, calculateEarnings, writeChores, getTodayKey } = require('../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await checkAndResetChores()
  const today = getTodayKey()
  if (!chores.weekday.completions[today]) chores.weekday.completions[today] = []
  const arr = chores.weekday.completions[today]
  const idx = arr.indexOf(req.query.id)
  if (idx === -1) arr.push(req.query.id)
  else arr.splice(idx, 1)
  await writeChores(chores)
  const settings = await getSettings()
  const earnings = calculateEarnings(chores, settings)
  res.json({ ...chores, earnings, todayCompletions: arr })
}
