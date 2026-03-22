// One-time convenience endpoint to seed news on first deploy
// Internally calls news-refresh — just a thin wrapper
import { createServer } from 'http'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = req.query.secret || req.headers['x-refresh-secret']
  const REFRESH_SECRET = process.env.NEWS_REFRESH_SECRET || 'change-this-secret'

  if (secret !== REFRESH_SECRET) {
    return res.status(403).json({
      error: 'Forbidden',
      hint: 'Add ?secret=YOUR_NEWS_REFRESH_SECRET to the URL, e.g: /api/news-seed?secret=my-secret'
    })
  }

  // Forward to news-refresh as a POST
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`
    const response = await fetch(`${baseUrl}/api/news-refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-secret': REFRESH_SECRET,
      },
    })
    const data = await response.json()
    return res.status(200).json({
      success: true,
      message: `Seeded ${data.generated || 0} news items. Visit your landing page to see them.`,
      ...data,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
