import { supabaseAdmin } from '../../lib/supabase'
import { cleanRows } from '../../lib/cleaner'
import { runAlertChecks } from '../../lib/alerts'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const db = supabaseAdmin()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' })

  const { data: quota, error: quotaErr } = await db
    .from('user_quota')
    .select('rows_used, rows_limit')
    .eq('user_id', user.id)
    .single()

  if (quotaErr || !quota) return res.status(400).json({ error: 'Could not load quota' })

  const { rows, filename } = req.body
  if (!rows?.length) return res.status(400).json({ error: 'No rows provided' })

  const rowCount = rows.length
  const rowsRemaining = quota.rows_limit - quota.rows_used

  if (rowCount > rowsRemaining) {
    return res.status(402).json({
      error: 'quota_exceeded',
      message: `You need ${rowCount} rows but only have ${rowsRemaining} remaining from your ${quota.rows_limit} total.`,
      rowsNeeded: rowCount,
      rowsRemaining,
    })
  }

  try {
    const { results, apiCallsMade, cacheSavings } = await cleanRows(rows)

    // Deduct quota
    await db.from('user_quota')
      .update({ rows_used: quota.rows_used + rowCount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    // Log usage
    await db.from('usage_log').insert({
      user_id: user.id,
      rows_cleaned: rowCount,
      filename: filename || 'upload.xlsx',
    })

    // ── Run alert checks against cleaned data (non-blocking) ──────────────
    runAlertChecks({
      userId:      user.id,
      cleanedRows: results,
      filename:    filename || 'upload.xlsx',
    }).catch(err => console.error('[alerts] check failed:', err.message))

    return res.status(200).json({
      success: true,
      results,
      rowsUsed:      rowCount,
      rowsRemaining: rowsRemaining - rowCount,
      apiCallsMade,
      cacheSavings,
    })
  } catch (err) {
    console.error('Cleaning error:', err)
    return res.status(500).json({ error: 'Cleaning failed: ' + err.message })
  }
}
