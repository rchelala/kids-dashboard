const { getChoresRaw, writeChores, getTodayKey } = require('../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const chores = await getChoresRaw()
  const { type, date } = req.body
  if (type === 'weekend') {
    chores.weekendCelebrationShown = true
  } else {
    const key = date || getTodayKey()
    if (!chores.celebrationShown) chores.celebrationShown = {}
    chores.celebrationShown[key] = true
  }
  await writeChores(chores)
  res.json({ success: true })
}
