import { supabaseAdmin } from './supabase'

// ── Normalise a string for fuzzy matching ─────────────────────────────────────
function normalise(str) {
  return String(str || '').toLowerCase().trim()
}

// ── Check if a watch criterion matches a value ────────────────────────────────
// Empty criterion = match anything
function matches(criterion, value) {
  if (!criterion || criterion.trim() === '') return true
  return normalise(value).includes(normalise(criterion))
}

// ── Run all active watches for a user against freshly cleaned rows ────────────
// Called at the end of /api/clean after a successful cleaning job
export async function runAlertChecks({ userId, cleanedRows, filename }) {
  if (!cleanedRows || cleanedRows.length === 0) return

  const db = supabaseAdmin()

  // Load all active watches for this user
  const { data: watches, error } = await db
    .from('alert_watches')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !watches || watches.length === 0) return

  const eventsToInsert = []

  for (const watch of watches) {
    for (const row of cleanedRows) {
      // Skip outlier rows — they have no reliable price/volume data
      if (row.Outlier === 'Yes') continue

      const price = parseFloat(row['Price ($/MT)']) || 0
      const vol   = parseFloat(row['Vols (MT)'])    || 0

      // Check each criterion
      const productMatch  = matches(watch.product,        row.Product)
      const gradeMatch    = matches(watch.grade,          row['Product Grade'])
      const importerMatch = matches(watch.importer,       row['Normalized Importer'])
      const supplierMatch = matches(watch.supplier,       row['Normalized Supplier'])
      const countryMatch  = matches(watch.origin_country, row['ORIGIN_COUNTRY'] || row['origin_country'] || '')
      const portMatch     = matches(watch.indian_port,    row['INDIAN_PORT']    || row['indian_port']    || '')

      // Price threshold checks
      const belowTriggered = watch.price_below_usd !== null && price > 0 && price < watch.price_below_usd
      const aboveTriggered = watch.price_above_usd !== null && price > 0 && price > watch.price_above_usd

      // All text criteria must match; price threshold is an optional extra condition
      const textMatch = productMatch && gradeMatch && importerMatch && supplierMatch && countryMatch && portMatch
      const priceMatch = (watch.price_below_usd === null && watch.price_above_usd === null)
        ? true  // no price threshold set — fire on text match alone
        : (belowTriggered || aboveTriggered)

      if (textMatch && priceMatch) {
        eventsToInsert.push({
          watch_id:         watch.id,
          user_id:          userId,
          matched_product:  row.Product               || '',
          matched_grade:    row['Product Grade']       || '',
          matched_importer: row['Normalized Importer'] || '',
          matched_supplier: row['Normalized Supplier'] || '',
          matched_price_usd: price || null,
          matched_volume_mt: vol   || null,
          matched_port:     row['INDIAN_PORT']    || row['indian_port']    || '',
          matched_origin:   row['ORIGIN_COUNTRY'] || row['origin_country'] || '',
          matched_month:    row.Month || '',
          matched_fy:       row.Year  || '',
          source_filename:  filename || '',
        })
      }
    }
  }

  if (eventsToInsert.length === 0) return

  // Remove duplicate events — same watch + same importer + same month
  // (prevents 100 rows in one file from generating 100 identical alerts)
  const seen = new Set()
  const deduped = eventsToInsert.filter(e => {
    const key = `${e.watch_id}|${e.matched_importer}|${e.matched_product}|${e.matched_month}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Insert alert events
  await db.from('alert_events').insert(deduped)

  // Update last_triggered_at and trigger_count for each watch that fired
  const firedWatchIds = [...new Set(deduped.map(e => e.watch_id))]
  for (const watchId of firedWatchIds) {
    const count = deduped.filter(e => e.watch_id === watchId).length
    await db.from('alert_watches')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: db.rpc ? undefined : undefined, // handled below
      })
      .eq('id', watchId)

    // Increment trigger count
    await db.rpc('increment_alert_count', { wid: watchId, amount: count })
      .catch(() => {}) // fallback — if RPC not set up just skip
  }

  console.log(`[alerts] ${deduped.length} events fired for user ${userId} from ${filename}`)
}
