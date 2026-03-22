import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Smart column finder ───────────────────────────────────────────────────────
// Handles: exact, case-insensitive, spaces/underscores, partial, word-match
// Priority: exact normalised → contains → all-words-present

const _colCache = new Map()

function norm(str) {
  return String(str).toLowerCase().replace(/[\s_\-\.]/g, '')
}

function findCol(rowKeys, candidates) {
  const cacheId = rowKeys.join('|') + '§' + candidates.join('|')
  if (_colCache.has(cacheId)) return _colCache.get(cacheId)

  const normKeys = rowKeys.map(k => ({ original: k, normed: norm(k) }))

  for (const candidate of candidates) {
    const normCand = norm(candidate)
    // Pass 1: exact normalised match
    const exact = normKeys.find(k => k.normed === normCand)
    if (exact) { _colCache.set(cacheId, exact.original); return exact.original }
    // Pass 2: one contains the other
    const contains = normKeys.find(k => k.normed.includes(normCand) || normCand.includes(k.normed))
    if (contains) { _colCache.set(cacheId, contains.original); return contains.original }
    // Pass 3: all meaningful words in candidate appear in key
    const words = candidate.toLowerCase().split(/[\s_\-]+/).filter(w => w.length > 2)
    if (words.length > 0) {
      const wordMatch = normKeys.find(k => words.every(w => k.normed.includes(w)))
      if (wordMatch) { _colCache.set(cacheId, wordMatch.original); return wordMatch.original }
    }
  }
  _colCache.set(cacheId, null)
  return null
}

function getVal(row, candidates) {
  const col = findCol(Object.keys(row), candidates)
  if (col && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
    return String(row[col]).trim()
  }
  return ''
}

// ── Column candidate lists ────────────────────────────────────────────────────
// Each list covers DGFT format + third-party formats (SEAIR, Zauba, IceGate,
// direct download exports with different headers)
const COLS = {
  // Indian port / port of destination
  PORT: [
    'INDIAN_PORT', 'Indian_Port', 'indian port', 'port of destination',
    'destination port', 'port', 'ind port', 'discharge port',
    'port of discharge', 'unloading port',
  ],
  // Unit of quantity
  UNIT: [
    'UNIT_QUANTITY', 'Unit_Quantity', 'unit qty', 'standard unit',
    'unit', 'uom', 'unit of measure', 'measure',
  ],
  // Shipment mode — used for air outlier detection when port name isn't conclusive
  MODE: [
    'Shipment Mode', 'shipment mode', 'mode', 'transport mode',
    'mode of shipment', 'mode of transport', 'TYP', 'typ',
  ],
  // Registration / bill of entry / shipment date
  DATE: [
    'REG_DATE', 'Reg_date', 'Date', 'date', 'registration date',
    'ship date', 'shipdate', 'bill date', 'invoice date',
    'be date', 'entry date', 'arrival date',
  ],
  // Quantity
  QTY: [
    'QUANTITY', 'Quantity', 'Standard Qty', 'standard qty',
    'qty', 'total qty', 'net qty', 'gross qty', 'QTY',
  ],
  // Total value in USD
  TOTAL_USD: [
    'TOTAL_VALUE_USD_EXCHANGE', 'Total_Value_USD_Exchange',
    'Estimated CIF Value $', 'estimated cif value',
    'Landed Value $', 'landed value',
    'total usd', 'usd value', 'value usd', 'total value usd',
    'fob usd', 'cif usd', 'invoice value usd',
    'Unit Rate $', 'Standard Unit Rate $',
  ],
  // Importer / consignee name
  IMPORTER: [
    'IMPORTER', 'Importer', 'Consignee Name', 'consignee name',
    'consignee', 'buyer', 'importer name', 'buyer name', 'indian buyer',
  ],
  // Importer / consignee address
  IMP_ADDR: [
    'IMPORTERADDRESS', 'Importeraddress', 'Consignee Address 1',
    'consignee address', 'importer address', 'buyer address',
    'consignee addr', 'buyer addr',
  ],
  // Supplier / shipper name
  SUP_NAME: [
    'SUPPLIER_NAME', 'Supplier_Name', 'Shipper Name', 'shipper name',
    'supplier', 'exporter', 'shipper', 'vendor', 'manufacturer',
    'seller', 'foreign supplier',
  ],
  // Supplier / shipper address
  SUP_ADDR: [
    'SUPPLIER_ADDRESS', 'Supplier_Address', 'Shipper Address1',
    'Shipper Address 2', 'shipper address', 'supplier address',
    'exporter address', 'vendor address', 'foreign address',
  ],
  // Product description
  DESC: [
    'ProductDescription', 'PRODUCTDESCRIPTION', 'Product Description',
    'product description', 'description', 'goods description',
    'item description', 'commodity', 'hs description', 'product',
    'goods', 'item name', 'product name',
  ],
  // Origin country
  ORIGIN: [
    'ORIGIN_COUNTRY', 'Country of Origin', 'origin country',
    'country of origin', 'origin', 'source country',
  ],
}

// ── Junk-row detector ─────────────────────────────────────────────────────────
// Scores each candidate header row by keyword matches × 10 + non-empty cell count
// The row with the highest score is the real header — handles files with summary
// blocks, pivot tables, formula rows, or report titles above the data.
export function findHeaderRow(rawRows) {
  const keywords = [
    'date','quantity','unit','importer','supplier','consignee',
    'shipper','description','product','port','country','value',
    'hs','shipment','invoice','qty','mode','origin','price','name',
    'address','code','weight','freight','cif','fob','standard',
  ]

  let bestIdx = 0
  let bestScore = -1

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i]
    const cells = Object.values(row).map(v => String(v || '').toLowerCase().trim())
    const nonEmpty  = cells.filter(v => v && v.length > 0 && !v.startsWith('=')).length
    const kwMatches = cells.filter(v =>
      v && !v.startsWith('=') && keywords.some(kw => v.includes(kw))
    ).length
    const score = kwMatches * 10 + nonEmpty
    if (score > bestScore) { bestScore = score; bestIdx = i }
  }

  return bestIdx
}

// ── Re-parse rows with correct header row ─────────────────────────────────────
// xlsx parses using row 0 as headers by default.
// If the real header is at row N, we rebuild the objects here.
export function rebaseRows(rawRows, headerRowIndex) {
  if (headerRowIndex === 0) return rawRows  // already correct

  // The header row gives us column names
  const headerRow = rawRows[headerRowIndex]
  const headers = Object.values(headerRow).map(v => String(v || '').trim())

  // Data starts after the header row
  return rawRows.slice(headerRowIndex + 1).map(row => {
    const values = Object.values(row)
    const obj = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = values[i] ?? ''
    })
    return obj
  }).filter(row => {
    // Filter out completely empty rows
    return Object.values(row).some(v => v !== '' && v !== null && v !== undefined)
  })
}

// ── Date parser ───────────────────────────────────────────────────────────────
// Handles: JS Date objects, Excel serial numbers (numeric or string),
// ISO date strings "2025-01-06T00:00:00.000Z", "Jan-2025", "06-Jan-2025"
function parseRegDate(dateVal) {
  if (!dateVal && dateVal !== 0) return null
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  let d

  if (dateVal instanceof Date) {
    d = dateVal
  } else if (typeof dateVal === 'number') {
    // Excel serial number (e.g. 45662)
    // Excel epoch is 1 Jan 1900, but has a leap year bug so offset is 25569 from Unix epoch
    d = new Date(Math.round((dateVal - 25569) * 86400 * 1000))
  } else {
    const s = String(dateVal).trim()
    // Already a formatted month label like "Jan-2025" or "Jan-25"
    const labelMatch = s.match(/^([A-Za-z]{3})-(\d{2,4})$/)
    if (labelMatch) {
      const mIdx = MONTHS.findIndex(m => m.toLowerCase() === labelMatch[1].toLowerCase())
      if (mIdx !== -1) {
        const yr = parseInt(labelMatch[2])
        const fullYr = yr < 100 ? 2000 + yr : yr
        return { month: mIdx + 1, year: fullYr, label: MONTHS[mIdx] + '-' + String(fullYr).slice(2) }
      }
    }
    // Numeric string that is an Excel serial (e.g. "45662")
    const numericSerial = parseFloat(s)
    if (!isNaN(numericSerial) && numericSerial > 40000 && numericSerial < 60000) {
      d = new Date(Math.round((numericSerial - 25569) * 86400 * 1000))
    } else {
      d = new Date(s)
    }
  }

  if (!d || isNaN(d.getTime())) return null
  const month = d.getUTCMonth() + 1   // use UTC to avoid timezone shifting the date
  const year  = d.getUTCFullYear()
  return {
    month,
    year,
    label: MONTHS[month - 1] + '-' + String(year).slice(2),
  }
}

// ── Indian Financial Year ─────────────────────────────────────────────────────
function getFinancialYear(month, year) {
  if (month < 4) return (year - 1) + '-' + year
  return year + '-' + (year + 1)
}

// ── Single Groq call: product + grade + importer + supplier in one shot ───────
async function callGroqBatch({ productDesc, importerInfo, supplierInfo }) {
  const parts = []
  if (productDesc) parts.push(
    `PRODUCT+GRADE: From this trade description: "${productDesc.slice(0, 200)}"
    - "product": broad category (e.g. "Carbon Black", "Steel", "Palm Oil", "Flame Retardant"). Reply "Others" if unclear.
    - "grade": specific grade/type/spec (e.g. "N330", "HR Coil", "RBD", "AMH-01S"). Reply "" if none mentioned.`
  )
  if (importerInfo) parts.push(`IMPORTER: "${importerInfo.slice(0, 250)}" → official normalized company name. Reply "N/A" if unclear.`)
  if (supplierInfo) parts.push(`SUPPLIER: "${supplierInfo.slice(0, 250)}" → official normalized company name. Reply "N/A" if unclear.`)
  if (!parts.length) return { product: 'Others', grade: '', importer: 'N/A', supplier: 'N/A' }

  const prompt = `You are a trade data analyst. Answer each task below.
Respond ONLY with raw JSON — no markdown, no explanation:
{"product":"...","grade":"...","importer":"...","supplier":"..."}

${parts.join('\n')}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.1,
    })
    const text = completion.choices[0]?.message?.content?.trim() || '{}'
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return {
      product:  String(parsed.product  || 'Others').replace(/['"]/g, '').trim() || 'Others',
      grade:    String(parsed.grade    || '').replace(/['"]/g, '').trim(),
      importer: String(parsed.importer || 'N/A').replace(/['"]/g, '').trim()    || 'N/A',
      supplier: String(parsed.supplier || 'N/A').replace(/['"]/g, '').trim()    || 'N/A',
    }
  } catch {
    return { product: 'Others', grade: '', importer: 'N/A', supplier: 'N/A' }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function cleanRows(rows) {
  if (!rows || rows.length === 0) return { results: [], apiCallsMade: 0, cacheSavings: 0 }

  // Detect and rebase headers if needed
  const headerIdx = findHeaderRow(rows)
  const dataRows = rebaseRows(rows, headerIdx)

  if (dataRows.length === 0) return { results: [], apiCallsMade: 0, cacheSavings: 0 }

  // Log detected columns for debugging
  const sampleKeys = Object.keys(dataRows[0])
  console.log('Header row detected at index:', headerIdx)
  console.log('Sample columns:', sampleKeys.slice(0, 15).join(', '))

  const cacheKey = str => String(str).trim().toLowerCase().slice(0, 120)

  // ── STEP 1: Deterministic fields — no AI needed ───────────────────────────
  const prepared = dataRows.map(row => {

    // Rule 1a — outlier if port name contains "air"
    const port = getVal(row, COLS.PORT).toLowerCase()
    // Rule 1a (alt) — outlier if Shipment Mode is "Air" (for files that use this column)
    const mode = getVal(row, COLS.MODE).toLowerCase()
    const portIsAir = port.includes('air') || mode === 'air'

    // Rule 1b — outlier if unit is not KGS or MTS
    const unit = getVal(row, COLS.UNIT).toUpperCase().trim()
    const unitIsInvalid = unit !== '' && unit !== 'KGS' && unit !== 'MTS'

    const isOutlier = portIsAir || unitIsInvalid

    // Rule 2 — Month from date
    const dateRaw = getVal(row, COLS.DATE)
    const dateNum = row[findCol(Object.keys(row), COLS.DATE)]
    const parsed  = parseRegDate(dateRaw || dateNum)

    // Rule 3 — Financial Year
    const fy = parsed ? getFinancialYear(parsed.month, parsed.year) : ''

    // Rule 4 — Vols (MT): only for non-outliers
    const qty = parseFloat(getVal(row, COLS.QTY)) || 0
    let volsMT = null
    if (!isOutlier && qty > 0) {
      volsMT = unit === 'KGS' ? qty / 1000 : qty
    }

    // Rule 5 — Price ($/MT)
    const totalUSD   = parseFloat(getVal(row, COLS.TOTAL_USD)) || 0
    const pricePerMT = (volsMT && volsMT > 0) ? totalUSD / volsMT : null

    // Also capture origin country for summary insights
    const origin = getVal(row, COLS.ORIGIN)

    return {
      ...row,
      _isOutlier: isOutlier,
      _unit: unit,
      ORIGIN_COUNTRY:   origin,         // ensure normalised key exists
      Outlier:          isOutlier ? 'Yes' : 'No',
      Month:            parsed ? parsed.label : '',
      Year:             fy,
      'Vols (MT)':      volsMT    !== null ? volsMT.toFixed(4)    : '',
      'Price ($/MT)':   pricePerMT !== null ? pricePerMT.toFixed(2) : '',
    }
  })

  // ── STEP 2: Collect unique AI tasks — skip outliers ───────────────────────
  const productCache = new Map()   // descKey → { product, grade }
  const entityCache  = new Map()   // entityKey → normalized name
  const uniqueDescs  = new Set()
  const uniqueImps   = new Set()
  const uniqueSups   = new Set()

  for (const row of prepared) {
    if (row._isOutlier) continue
    const desc = getVal(row, COLS.DESC)
    const imp  = `${getVal(row, COLS.IMPORTER)} ${getVal(row, COLS.IMP_ADDR)}`.trim()
    const sup  = `${getVal(row, COLS.SUP_NAME)} ${getVal(row, COLS.SUP_ADDR)}`.trim()
    if (desc) uniqueDescs.add(cacheKey(desc))
    if (imp)  uniqueImps.add(cacheKey(imp))
    if (sup)  uniqueSups.add(cacheKey(sup))
  }

  // ── STEP 3: One Groq call handles product + grade + importer + supplier ────
  const descArr = [...uniqueDescs]
  const impArr  = [...uniqueImps]
  const supArr  = [...uniqueSups]
  const maxLen  = Math.max(descArr.length, impArr.length, supArr.length)

  const jobs = Array.from({ length: maxLen }, (_, i) => ({
    descKey: descArr[i] || null,
    impKey:  impArr[i]  || null,
    supKey:  supArr[i]  || null,
  }))

  const CONCURRENCY = 5
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async job => {
      const r = await callGroqBatch({
        productDesc:  job.descKey,
        importerInfo: job.impKey,
        supplierInfo: job.supKey,
      })
      if (job.descKey) productCache.set(job.descKey, { product: r.product, grade: r.grade })
      if (job.impKey)  entityCache.set(job.impKey,   r.importer)
      if (job.supKey)  entityCache.set(job.supKey,   r.supplier)
    }))
  }

  // ── STEP 4: Apply AI results to every row ─────────────────────────────────
  const results = prepared.map(({ _isOutlier, _unit, ...row }) => {
    if (_isOutlier) {
      return {
        ...row,
        Product:               'N/A (Outlier)',
        'Product Grade':       'N/A (Outlier)',
        'Normalized Importer': 'N/A (Outlier)',
        'Normalized Supplier': 'N/A (Outlier)',
      }
    }
    const desc     = getVal(row, COLS.DESC)
    const imp      = `${getVal(row, COLS.IMPORTER)} ${getVal(row, COLS.IMP_ADDR)}`.trim()
    const sup      = `${getVal(row, COLS.SUP_NAME)} ${getVal(row, COLS.SUP_ADDR)}`.trim()
    const prodData = productCache.get(cacheKey(desc)) || { product: 'Others', grade: '' }

    return {
      ...row,
      Product:               prodData.product,
      'Product Grade':       prodData.grade,
      'Normalized Importer': entityCache.get(cacheKey(imp)) || 'N/A',
      'Normalized Supplier': entityCache.get(cacheKey(sup)) || 'N/A',
    }
  })

  return {
    results,
    apiCallsMade: jobs.length,
    cacheSavings: dataRows.length * 3 - jobs.length,
    headerRowDetected: headerIdx,
    totalInputRows: rows.length,
    dataRowsProcessed: dataRows.length,
  }
}
