import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const db = supabaseAdmin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid session' })

  const [{ data: quota }, { data: history }] = await Promise.all([
    db.from('user_quota').select('*').eq('user_id', user.id).single(),
    db.from('usage_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])

  return res.status(200).json({ quota, history: history || [] })
}
