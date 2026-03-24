const { checkAndResetChores, getSettings, calculateEarnings, getTodayKey } = require('../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const chores = await checkAndResetChores()
  const settings = await getSettings()
  const earnings = calculateEarnings(chores, settings)
  const todayCompletions = chores.weekday.completions[getTodayKey()] || []
  res.json({ ...chores, earnings, todayCompletions })
}
