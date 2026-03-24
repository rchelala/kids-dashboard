const { supabase } = require('./_lib/supabase')
const { getSettings, getICalEvents } = require('./_lib/helpers')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const settings = await getSettings()
  const { data: localEvents } = await supabase.from('calendar_events').select('*').is('source', null)
  const icalEvents = await getICalEvents(settings.icalUrl)
  const all = [...(localEvents || []), ...icalEvents].sort((a, b) => a.date.localeCompare(b.date))
  res.json(all)
}
