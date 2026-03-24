const { getChoresRaw, writeChores } = require('../../../../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()
  const chores = await getChoresRaw()
  const id = req.query.id
  chores.weekend.pool = chores.weekend.pool.filter(c => c.id !== id)
  chores.weekend.active = chores.weekend.active.filter(a => a !== id)
  if (chores.weekend.completions) delete chores.weekend.completions[id]
  await writeChores(chores)
  res.json(chores)
}
