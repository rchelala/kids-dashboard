const { getChoresRaw, writeChores } = require('../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()
  const chores = await getChoresRaw()
  chores.weekday.items = chores.weekday.items.filter(c => c.id !== req.query.id)
  await writeChores(chores)
  res.json(chores)
}
