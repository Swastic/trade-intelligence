import Groq from 'groq-sdk'
import { supabaseAdmin } from '../../lib/supabase'

// Protect with a simple secret so only your cron can call it
// Set NEWS_REFRESH_SECRET in your .env.local
const REFRESH_SECRET = process.env.NEWS_REFRESH_SECRET || 'change-this-secret'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Slugify a headline ────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    + '-' + Date.now()
}

// ── Categories and seed topics to generate news about ────────────────────────
const TOPICS = [
  { category: 'Policy',    topic: 'recent DGFT notifications, export promotion schemes, import policy changes, FTP 2023 updates' },
  { category: 'Tariff',    topic: 'recent BCD changes, anti-dumping duties, safeguard duties, GST rate changes on imported goods in India' },
  { category: 'Commodity', topic: 'India imports of steel, carbon black, palm oil, chemicals, textiles — price trends and volume changes' },
  { category: 'Market',    topic: 'India trade deficit, export growth, top trading partners, rupee impact on imports/exports' },
  { category: 'Port',      topic: 'Nhava Sheva, Mundra, Chennai, Kolkata port — congestion, new facilities, turnaround times, dwell times' },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth check
  const secret = req.headers['x-refresh-secret'] || req.body?.secret
  if (secret !== REFRESH_SECRET) return res.status(403).json({ error: 'Forbidden' })

  const db = supabaseAdmin()
  const generated = []

  for (const { category, topic } of TOPICS) {
    try {
      const prompt = `You are a trade intelligence analyst specialising in India's import and export sector.

Generate 2 realistic, factual-sounding trade news items about: ${topic}

For each news item, respond with ONLY raw JSON (no markdown):
[
  {
    "headline": "Short, specific, SEO-friendly headline under 90 chars. Include product names, country names, percentages. E.g.: 'India Anti-Dumping Duty on Chinese Carbon Black Extended for 5 Years'",
    "summary": "2-3 sentences. Specific and informative. Mention HS codes, duty rates, volumes, prices where relevant. Write as if reporting real recent developments.",
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "source_name": "One of: DGFT | Ministry of Commerce | PIB | CBIC | Directorate General of Trade Remedies",
    "meta_description": "Under 155 chars, SEO optimised, includes key trade terms"
  }
]`

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7,  // slightly higher for variety
      })

      const text = completion.choices[0]?.message?.content?.trim() || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const items = JSON.parse(clean)

      for (const item of items) {
        if (!item.headline || !item.summary) continue
        const newsItem = {
          headline:         String(item.headline).slice(0, 200),
          summary:          String(item.summary),
          category,
          tags:             Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
          source_name:      String(item.source_name || ''),
          source_url:       '',
          slug:             slugify(item.headline),
          meta_description: String(item.meta_description || '').slice(0, 155),
          published_at:     new Date().toISOString(),
          is_published:     true,
        }
        generated.push(newsItem)
      }
    } catch (err) {
      console.error(`News gen error for ${category}:`, err.message)
    }
  }

  if (generated.length === 0) {
    return res.status(500).json({ error: 'No news generated' })
  }

  // Insert into DB (ignore slug conflicts — unique constraint)
  const { data, error } = await db
    .from('trade_news')
    .insert(generated)
    .select('id, headline, category')

  if (error) return res.status(500).json({ error: error.message })

  // Keep only latest 200 news items — auto-prune old ones
  const { data: allNews } = await db
    .from('trade_news')
    .select('id')
    .order('published_at', { ascending: false })

  if (allNews && allNews.length > 200) {
    const toDelete = allNews.slice(200).map(n => n.id)
    await db.from('trade_news').delete().in('id', toDelete)
  }

  return res.status(200).json({
    success: true,
    generated: data?.length || 0,
    items: data,
  })
}
