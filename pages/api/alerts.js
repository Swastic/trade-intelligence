import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const db = supabaseAdmin()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' })

  // ── GET — fetch watches + unread alert events ────────────────────────────
  if (req.method === 'GET') {
    const [{ data: watches }, { data: events }] = await Promise.all([
      db.from('alert_watches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db.from('alert_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    return res.status(200).json({ watches: watches || [], events: events || [] })
  }

  // ── POST — create a new watch ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, watch_type, product, grade, importer, supplier,
            origin_country, indian_port, price_below_usd, price_above_usd } = req.body

    if (!name?.trim()) return res.status(400).json({ error: 'Watch name is required' })

    const { data, error } = await db.from('alert_watches').insert({
      user_id: user.id,
      name: name.trim(),
      watch_type: watch_type || 'import',
      product:        product        || '',
      grade:          grade          || '',
      importer:       importer       || '',
      supplier:       supplier       || '',
      origin_country: origin_country || '',
      indian_port:    indian_port    || '',
      price_below_usd: price_below_usd ? parseFloat(price_below_usd) : null,
      price_above_usd: price_above_usd ? parseFloat(price_above_usd) : null,
    }).select().single()

    if (error) return res.status(400).json({ error: error.message })
    return res.status(201).json({ watch: data })
  }

  // ── DELETE — remove a watch ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Watch ID required' })
    await db.from('alert_watches').delete().eq('id', id).eq('user_id', user.id)
    return res.status(200).json({ success: true })
  }

  // ── PATCH — mark alert event as read ────────────────────────────────────
  if (req.method === 'PATCH') {
    const { event_id, mark_all_read } = req.body
    if (mark_all_read) {
      await db.from('alert_events').update({ is_read: true }).eq('user_id', user.id)
    } else if (event_id) {
      await db.from('alert_events').update({ is_read: true }).eq('id', event_id).eq('user_id', user.id)
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
