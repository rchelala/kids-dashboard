const { getSettings } = require('../_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const settings = await getSettings()
  if (req.body.password === settings.adminPassword) {
    res.json({ success: true })
  } else {
    res.status(401).json({ success: false, message: 'Wrong password' })
  }
}
