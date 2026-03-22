import { supabaseAdmin } from '../../lib/supabase'

// Public endpoint — no auth needed
// Returns latest trade news for landing page + sitemap
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const db = supabaseAdmin()
  const limit = Math.min(parseInt(req.query.limit || '12'), 50)
  const category = req.query.category || null

  let query = db
    .from('trade_news')
    .select('id, headline, summary, category, tags, source_name, source_url, slug, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Cache for 1 hour on CDN — great for SEO, reduces DB load
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  return res.status(200).json({ news: data || [] })
}
