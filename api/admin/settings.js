const { getSettings, updateSettings } = require('../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end()
  const settings = await getSettings()
  const updated = await updateSettings({ ...settings, ...req.body })
  res.json(updated)
}
