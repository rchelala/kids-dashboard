const { getSettings } = require('./_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const settings = await getSettings()
  const { adminPassword: _, ...safe } = settings
  res.json(safe)
}
