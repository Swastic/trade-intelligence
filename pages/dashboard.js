import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

// ── Number formatter (no locale dependency) ───────────────────────────────────
function commas(n) {
  return String(Math.floor(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Small UI helpers ──────────────────────────────────────────────────────────
function Tag({ label, color }) {
  return <span className="tag" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>{label}</span>
}

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 10, letterSpacing: 1 }}>{label.toUpperCase()}</div>
        {icon && <span style={{ fontSize: 18, opacity: 0.6 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function InsightCard({ icon, title, value, detail, color = 'var(--accent)' }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 20 }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4, letterSpacing: 1 }}>{title.toUpperCase()}</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color, marginBottom: 4, wordBreak: 'break-word' }}>{value}</div>
        {detail && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{detail}</div>}
      </div>
    </div>
  )
}

function BarRow({ label, value, total, color, suffix = '' }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
        <span style={{ fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{label}</span>
        <span style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
          {typeof value === 'number' ? value.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : value}{suffix} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="quota-bar-track">
        <div className="quota-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Full analytics engine ─────────────────────────────────────────────────────
function buildSummary(cleanedRows) {
  if (!cleanedRows || cleanedRows.length === 0) return null

  const valid   = cleanedRows.filter(r => r.Outlier === 'No')
  const outliers = cleanedRows.filter(r => r.Outlier === 'Yes')

  // Volume & price
  const totalVol  = valid.reduce((s, r) => s + (parseFloat(r['Vols (MT)']) || 0), 0)
  const priceRows = valid.filter(r => parseFloat(r['Price ($/MT)']) > 0)
  const avgPrice  = priceRows.length ? priceRows.reduce((s, r) => s + parseFloat(r['Price ($/MT)']), 0) / priceRows.length : 0
  const minPrice  = priceRows.length ? Math.min(...priceRows.map(r => parseFloat(r['Price ($/MT)']))) : 0
  const maxPrice  = priceRows.length ? Math.max(...priceRows.map(r => parseFloat(r['Price ($/MT)']))) : 0
  const totalUSD  = valid.reduce((s, r) => s + (parseFloat(r['Total_Value_USD_Exchange'] || r['TOTAL_VALUE_USD_EXCHANGE']) || 0), 0)

  // Helper: group by field, sum volume
  const groupByVol = (field) => {
    const map = {}
    valid.forEach(r => {
      const key = (r[field] || 'Unknown').toString().trim() || 'Unknown'
      map[key] = (map[key] || 0) + (parseFloat(r['Vols (MT)']) || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  // Helper: group by field, count rows
  const groupByCount = (field) => {
    const map = {}
    valid.forEach(r => {
      const key = (r[field] || 'Unknown').toString().trim() || 'Unknown'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  // Helper: group by field, sum USD value
  const groupByUSD = (field) => {
    const map = {}
    valid.forEach(r => {
      const key = (r[field] || 'Unknown').toString().trim() || 'Unknown'
      const usd = parseFloat(r['Total_Value_USD_Exchange'] || r['TOTAL_VALUE_USD_EXCHANGE']) || 0
      map[key] = (map[key] || 0) + usd
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  const topProducts    = groupByVol('Product').slice(0, 6)
  const topGrades      = groupByVol('Product Grade').filter(([k]) => k && k !== '' && k !== 'N/A (Outlier)').slice(0, 6)
  const topImporters   = groupByVol('Normalized Importer').filter(([k]) => k !== 'N/A' && k !== 'N/A (Outlier)').slice(0, 6)
  const topSuppliers   = groupByVol('Normalized Supplier').filter(([k]) => k !== 'N/A' && k !== 'N/A (Outlier)').slice(0, 6)
  const byPort         = groupByVol('INDIAN_PORT').slice(0, 6)
  const byOrigin       = groupByVol('ORIGIN_COUNTRY').slice(0, 6)
  const byMonth        = groupByVol('Month')
  const byUnit         = groupByCount('UNIT_QUANTITY').slice(0, 5)

  // ── FY sort: parse "2023-2024" → start year integer, sort ascending ───────
  const byFY = groupByVol('Year').sort((a, b) => {
    const startA = parseInt(String(a[0]).split('-')[0]) || 0
    const startB = parseInt(String(b[0]).split('-')[0]) || 0
    return startA - startB
  })

  // Month-over-month trend (last 12 months sorted chronologically)
  const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthTrend = byMonth
    .sort((a, b) => {
      const [am, ay] = a[0].split('-')
      const [bm, by_] = b[0].split('-')
      return (parseInt(ay) * 12 + monthOrder.indexOf(am)) - (parseInt(by_) * 12 + monthOrder.indexOf(bm))
    })
    .slice(-12)

  const maxMonthVol = Math.max(...monthTrend.map(m => m[1]), 1)

  // Price range insight
  const priceSpread = maxPrice - minPrice
  const priceCV = avgPrice > 0 ? (priceSpread / avgPrice) * 100 : 0 // coefficient of variation

  // Top importer by USD value
  const topImporterByUSD = groupByUSD('Normalized Importer')
    .filter(([k]) => k !== 'N/A' && k !== 'N/A (Outlier)').slice(0, 1)

  // Top supplier by USD value
  const topSupplierByUSD = groupByUSD('Normalized Supplier')
    .filter(([k]) => k !== 'N/A' && k !== 'N/A (Outlier)').slice(0, 1)

  // Concentration: top 3 products as % of total volume
  const top3VolShare = topProducts.slice(0, 3).reduce((s, [, v]) => s + v, 0)
  const top3Pct = totalVol > 0 ? (top3VolShare / totalVol) * 100 : 0

  // Outlier rate
  const outlierRate = cleanedRows.length > 0 ? (outliers.length / cleanedRows.length) * 100 : 0

  // Generate plain-English key insights
  const insights = []

  if (topProducts[0]) {
    const [prod, vol] = topProducts[0]
    const pct = totalVol > 0 ? (vol / totalVol) * 100 : 0
    insights.push({
      icon: '🏆', title: 'Dominant Product',
      value: prod,
      detail: `${vol.toFixed(0)} MT — ${pct.toFixed(1)}% of total import volume`,
      color: 'var(--gold)',
    })
  }

  if (topImporters[0]) {
    const [imp, vol] = topImporters[0]
    const pct = totalVol > 0 ? (vol / totalVol) * 100 : 0
    insights.push({
      icon: '🏢', title: 'Largest Importer',
      value: imp,
      detail: `${vol.toFixed(0)} MT imported · ${pct.toFixed(1)}% of total volume`,
      color: 'var(--accent)',
    })
  }

  if (topSuppliers[0]) {
    const [sup, vol] = topSuppliers[0]
    const pct = totalVol > 0 ? (vol / totalVol) * 100 : 0
    insights.push({
      icon: '🌏', title: 'Top Supplier',
      value: sup,
      detail: `${vol.toFixed(0)} MT supplied · ${pct.toFixed(1)}% of total volume`,
      color: 'var(--success)',
    })
  }

  if (byOrigin[0]) {
    const [country, vol] = byOrigin[0]
    const pct = totalVol > 0 ? (vol / totalVol) * 100 : 0
    insights.push({
      icon: '🗺️', title: 'Top Origin Country',
      value: country,
      detail: `${vol.toFixed(0)} MT · ${pct.toFixed(1)}% of import volume`,
      color: '#a78bfa',
    })
  }

  if (avgPrice > 0) {
    insights.push({
      icon: priceCV > 50 ? '⚠️' : '💹', title: 'Price Volatility',
      value: priceCV > 50 ? 'High Variance' : priceCV > 20 ? 'Moderate Variance' : 'Stable Pricing',
      detail: `Range: $${minPrice.toFixed(0)}–$${maxPrice.toFixed(0)}/MT · Avg: $${avgPrice.toFixed(0)}/MT · Spread: ${priceCV.toFixed(0)}%`,
      color: priceCV > 50 ? 'var(--danger)' : priceCV > 20 ? 'var(--gold)' : 'var(--success)',
    })
  }

  if (top3Pct > 0) {
    insights.push({
      icon: top3Pct > 80 ? '🔴' : top3Pct > 60 ? '🟡' : '🟢',
      title: 'Portfolio Concentration',
      value: `${top3Pct.toFixed(0)}% in top 3 products`,
      detail: top3Pct > 80
        ? 'Highly concentrated — significant dependency risk on a few products'
        : top3Pct > 60
        ? 'Moderately concentrated — consider diversifying the import portfolio'
        : 'Well diversified across multiple product categories',
      color: top3Pct > 80 ? 'var(--danger)' : top3Pct > 60 ? 'var(--gold)' : 'var(--success)',
    })
  }

  if (byFY.length > 1) {
    const [fy1, v1] = byFY[byFY.length - 2]
    const [fy2, v2] = byFY[byFY.length - 1]
    const growth = v1 > 0 ? ((v2 - v1) / v1) * 100 : 0
    insights.push({
      icon: growth >= 0 ? '📈' : '📉', title: 'Year-on-Year Volume',
      value: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs prior FY`,
      detail: `${fy1}: ${v1.toFixed(0)} MT → ${fy2}: ${v2.toFixed(0)} MT`,
      color: growth >= 0 ? 'var(--success)' : 'var(--danger)',
    })
  }

  if (outlierRate > 0) {
    insights.push({
      icon: '🔍', title: 'Data Quality',
      value: `${outlierRate.toFixed(1)}% outlier rate`,
      detail: `${outliers.length} rows flagged (air shipments or non-standard units) out of ${cleanedRows.length} total`,
      color: outlierRate > 10 ? 'var(--danger)' : outlierRate > 5 ? 'var(--gold)' : 'var(--success)',
    })
  }

  return {
    totalRows: cleanedRows.length, validRows: valid.length, outlierCount: outliers.length,
    totalVol, avgPrice, minPrice, maxPrice, totalUSD, outlierRate,
    topProducts, topGrades, topImporters, topSuppliers, byPort, byOrigin,
    byMonth, monthTrend, maxMonthVol, byFY, byUnit,
    insights, top3Pct,
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [mounted, setMounted]     = useState(false)
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [quota, setQuota]         = useState(null)
  const [history, setHistory]     = useState([])
  const [tab, setTab]             = useState('upload')

  // Prevent any SSR rendering — dashboard uses browser-only APIs
  useEffect(() => setMounted(true), [])

  const [file, setFile]           = useState(null)
  const [rawRows, setRawRows]     = useState(null)
  const [dragging, setDragging]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef()

  const [cleaning, setCleaning]   = useState(false)
  const [cleanStats, setCleanStats] = useState(null)
  const [cleanedRows, setCleanedRows] = useState(null)
  const [quotaError, setQuotaError]   = useState(null)

  // ── Alerts state ──────────────────────────────────────────────────────────
  const [watches, setWatches]         = useState([])
  const [alertEvents, setAlertEvents] = useState([])
  const [newWatch, setNewWatch]       = useState({
    name: '', watch_type: 'import', product: '', grade: '',
    importer: '', supplier: '', origin_country: '', indian_port: '',
    price_below_usd: '', price_above_usd: '',
  })
  const [watchSaving, setWatchSaving] = useState(false)
  const [watchError, setWatchError]   = useState('')

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setSession(session); setUser(session.user)
      fetchQuota(session.access_token)
      fetchAlerts(session.access_token)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (!s) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchQuota = async (token) => {
    const res  = await fetch('/api/quota', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.quota)   setQuota(data.quota)
    if (data.history) setHistory(data.history)
  }

  const fetchAlerts = async (token) => {
    try {
      const res  = await fetch('/api/alerts', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.watches) setWatches(data.watches)
      if (data.events)  setAlertEvents(data.events)
    } catch {}
  }

  const saveWatch = async () => {
    if (!newWatch.name.trim()) { setWatchError('Give your watch a name'); return }
    setWatchSaving(true); setWatchError('')
    try {
      const res  = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(newWatch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWatches(w => [data.watch, ...w])
      setNewWatch({ name: '', watch_type: 'import', product: '', grade: '', importer: '', supplier: '', origin_country: '', indian_port: '', price_below_usd: '', price_above_usd: '' })
    } catch (err) { setWatchError(err.message) }
    setWatchSaving(false)
  }

  const deleteWatch = async (id) => {
    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    setWatches(w => w.filter(x => x.id !== id))
  }

  const markAllRead = async () => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ mark_all_read: true }),
    })
    setAlertEvents([])
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // ── File upload ───────────────────────────────────────────────────────────
  const processFile = (f) => {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setUploadError('Please upload an .xlsx or .xls file'); return }
    setFile(f); setUploadError(''); setCleanedRows(null); setQuotaError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })

        // ── STEP 1: Pick the best sheet ───────────────────────────────────
        // Score each sheet: prefer the one with the most data rows AND
        // most columns. Skip summary/readme/calculation sheets.
        const SKIP_SHEET_WORDS = ['calc', 'readme', 'read me', 'summary', 'pivot', 'dashboard']
        let bestSheet = null
        let bestScore = -1

        for (const sheetName of wb.SheetNames) {
          const nameLower = sheetName.toLowerCase()
          if (SKIP_SHEET_WORDS.some(w => nameLower.includes(w))) continue

          const ws = wb.Sheets[sheetName]
          const ref = ws['!ref']
          if (!ref) continue
          const range = XLSX.utils.decode_range(ref)
          const rows = range.e.r - range.s.r + 1
          const cols = range.e.c - range.s.c + 1
          const score = rows * cols   // more rows × more cols = better sheet
          if (score > bestScore) { bestScore = score; bestSheet = sheetName }
        }

        // Fallback to first sheet if nothing matched
        const sheetToUse = bestSheet || wb.SheetNames[0]
        const ws = wb.Sheets[sheetToUse]

        // ── STEP 2: Find the real header row ──────────────────────────────
        // Use cellDates:true so Excel serial numbers become real JS Date objects
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', cellDates: true })

        const keywords = [
          'date','quantity','unit','importer','supplier','consignee',
          'shipper','description','product','port','country','value',
          'hs','shipment','invoice','qty','mode','origin','price','name',
          'address','code','weight','freight','cif','fob','standard',
        ]

        let bestHeaderIdx = 0
        let bestHeaderScore = -1

        for (let i = 0; i < Math.min(allRows.length, 10); i++) {
          const cells = allRows[i].map(v => String(v || '').toLowerCase().trim())
          const nonEmpty = cells.filter(v => v && v.length > 0 && !v.startsWith('=')).length
          const kwMatches = cells.filter(v =>
            v && !v.startsWith('=') && keywords.some(kw => v.includes(kw))
          ).length
          // Score: keyword matches × 10 + non-empty cell count
          // This way a row with 20 trade keywords beats a row with 4 keywords
          const score = kwMatches * 10 + nonEmpty
          if (score > bestHeaderScore) {
            bestHeaderScore = score
            bestHeaderIdx = i
          }
        }

        // ── STEP 3: Build row objects from detected header ────────────────
        const headers = allRows[bestHeaderIdx].map(v => String(v || '').trim())
        const dataRows = allRows.slice(bestHeaderIdx + 1)
          .map(row => {
            const obj = {}
            headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? '' })
            return obj
          })
          .filter(row =>
            Object.values(row).some(v => v !== '' && v !== null && v !== undefined)
          )

        if (dataRows.length === 0) {
          setUploadError(`No data rows found. Tried sheet "${sheetToUse}", header at row ${bestHeaderIdx + 1}.`)
          return
        }

        console.log(`Sheet: "${sheetToUse}" | Header row: ${bestHeaderIdx + 1} | Data rows: ${dataRows.length} | Columns: ${headers.filter(Boolean).length}`)
        setRawRows(dataRows)

      } catch (err) { setUploadError('Could not parse file: ' + err.message) }
    }
    reader.readAsArrayBuffer(f)
  }

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }, [])

  // ── Clean ─────────────────────────────────────────────────────────────────
  const startCleaning = async () => {
    if (!rawRows || !session) return
    setCleaning(true); setQuotaError(null)
    try {
      const res  = await fetch('/api/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ rows: rawRows, filename: file?.name }),
      })
      const data = await res.json()
      if (res.status === 402) { setQuotaError(data); setCleaning(false); return }
      if (!res.ok) throw new Error(data.error || 'Cleaning failed')
      setCleanedRows(data.results)
      setCleanStats({ apiCallsMade: data.apiCallsMade, cacheSavings: data.cacheSavings, rowsUsed: data.rowsUsed, rowsRemaining: data.rowsRemaining })
      setQuota(q => q ? { ...q, rows_used: q.rows_used + data.rowsUsed } : q)
      setTab('results')
    } catch (err) { setUploadError('Error: ' + err.message) }
    finally { setCleaning(false) }
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadCleaned = () => {
    if (!cleanedRows) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanedRows), 'Cleaned Data')
    XLSX.writeFile(wb, `trade_cleaned_${Date.now()}.xlsx`)
  }

  const downloadSummaryExcel = (s) => {
    if (!s) return
    const wb = XLSX.utils.book_new()
    const addSheet = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
    addSheet('Overview', [
      { Metric: 'Total Rows', Value: s.totalRows },
      { Metric: 'Valid Rows', Value: s.validRows },
      { Metric: 'Outliers', Value: s.outlierCount },
      { Metric: 'Outlier Rate %', Value: s.outlierRate.toFixed(2) },
      { Metric: 'Total Volume MT', Value: s.totalVol.toFixed(2) },
      { Metric: 'Avg Price $/MT', Value: s.avgPrice.toFixed(2) },
      { Metric: 'Min Price $/MT', Value: s.minPrice.toFixed(2) },
      { Metric: 'Max Price $/MT', Value: s.maxPrice.toFixed(2) },
      { Metric: 'Total Value USD', Value: s.totalUSD.toFixed(2) },
    ])
    addSheet('Top Products',  s.topProducts.map(([p, v])  => ({ Product: p,  'Volume MT': v.toFixed(2), 'Share %': s.totalVol > 0 ? ((v/s.totalVol)*100).toFixed(2) : 0 })))
    if (s.topGrades?.length) addSheet('Top Grades', s.topGrades.map(([g, v]) => ({ Grade: g, 'Volume MT': v.toFixed(2), 'Share %': s.totalVol > 0 ? ((v/s.totalVol)*100).toFixed(2) : 0 })))
    addSheet('Top Importers', s.topImporters.map(([p, v]) => ({ Importer: p, 'Volume MT': v.toFixed(2), 'Share %': s.totalVol > 0 ? ((v/s.totalVol)*100).toFixed(2) : 0 })))
    addSheet('Top Suppliers', s.topSuppliers.map(([p, v]) => ({ Supplier: p, 'Volume MT': v.toFixed(2), 'Share %': s.totalVol > 0 ? ((v/s.totalVol)*100).toFixed(2) : 0 })))
    addSheet('By Country',    s.byOrigin.map(([p, v])     => ({ Country: p,  'Volume MT': v.toFixed(2), 'Share %': s.totalVol > 0 ? ((v/s.totalVol)*100).toFixed(2) : 0 })))
    addSheet('By Port',       s.byPort.map(([p, v])       => ({ Port: p,     'Volume MT': v.toFixed(2), 'Share %': s.totalVol > 0 ? ((v/s.totalVol)*100).toFixed(2) : 0 })))
    addSheet('Monthly Trend', s.monthTrend.map(([m, v])   => ({ Month: m,    'Volume MT': v.toFixed(2) })))
    addSheet('By FY',         s.byFY.map(([y, v])         => ({ 'Financial Year': y, 'Volume MT': v.toFixed(2) })))
    XLSX.writeFile(wb, `trade_summary_${Date.now()}.xlsx`)
  }

  // Derived
  const summary        = buildSummary(cleanedRows)
  const rowsRemaining  = quota ? quota.rows_limit - quota.rows_used : 0
  const quotaPct       = quota ? Math.min((quota.rows_used / quota.rows_limit) * 100, 100) : 0
  const quotaColor     = quotaPct > 90 ? 'var(--danger)' : quotaPct > 70 ? 'var(--gold)' : 'var(--success)'
  const newCols        = ['Outlier','Month','Year','Vols (MT)','Price ($/MT)','Product','Product Grade','Normalized Importer','Normalized Supplier']
  const displayCols    = cleanedRows ? newCols.concat(Object.keys(cleanedRows[0]||{}).filter(k=>!newCols.includes(k))).slice(0,10) : []
  const CHART_COLORS   = ['var(--accent)','var(--gold)','var(--success)','#a78bfa','#fb923c','#38bdf8']

  if (!mounted) return null

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <span className="spinner spin" style={{ width:32, height:32, borderWidth:3 }} />
    </div>
  )

  return (
    <>
      <Head><title>Dashboard — Trade Intelligence</title></Head>

      {/* ── EXIM Ledger Nav ─────────────────────────────────────────────────── */}
      <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(247,249,251,0.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid #e6e8ea', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 40px', fontFamily:'Inter,sans-serif' }}>
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <Link href="/" style={{ textDecoration:'none' }}>
            <div style={{ fontSize:15, fontFamily:'Manrope,sans-serif', fontWeight:800, color:'#041627' }}>Trade Intelligence</div>
            <div style={{ fontSize:8, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'#44474c' }}>Enterprise Ledger</div>
          </Link>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e' }} />
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'#0ea5e9' }}>Live</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {quota && (
            <div style={{ background:'#fff', border:'1px solid #e6e8ea', borderRadius:4, padding:'6px 14px', display:'flex', alignItems:'center', gap:10, minWidth:200 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:quotaColor, fontFamily:'Inter,sans-serif' }}>{commas(rowsRemaining)} rows left</span>
                  <span style={{ fontSize:10, color:'#44474c', fontFamily:'Inter,sans-serif' }}>{commas(quota.rows_limit)} total</span>
                </div>
                <div style={{ height:3, background:'#e6e8ea', borderRadius:2 }}>
                  <div style={{ height:'100%', width:quotaPct+'%', background:quotaColor, borderRadius:2, transition:'width .3s' }} />
                </div>
              </div>
            </div>
          )}
          <span style={{ fontSize:12, color:'#44474c', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</span>
          <button onClick={handleLogout} style={{ padding:'7px 16px', background:'transparent', border:'1px solid rgba(196,198,205,.5)', borderRadius:4, fontSize:12, fontFamily:'Inter,sans-serif', fontWeight:600, color:'#191c1e', cursor:'pointer' }}>Logout</button>
        </div>
      </header>

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 40px 60px' }}>

        {/* ── EXIM Ledger Tabs ─────────────────────────────────────────────── */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid #e6e8ea', marginBottom:40, overflowX:'auto' }}>
          {[
            { id:'upload',   label:'Upload & Clean',  icon:'↑' },
            { id:'insights', label:'Insights',         icon:'◈', disabled:!cleanedRows },
            { id:'results',  label:'Data Table',       icon:'≡', disabled:!cleanedRows },
            { id:'alerts',   label: alertEvents.length > 0 ? 'Alerts (' + alertEvents.length + ')' : 'Alerts', icon:'◉' },
            { id:'history',  label:'History',          icon:'◷' },
          ].map(t => (
            <button key={t.id} onClick={() => !t.disabled && setTab(t.id)} style={{
              padding:'14px 20px', background:'none', border:'none', borderBottom: tab===t.id ? '2px solid #0ea5e9' : '2px solid transparent',
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              fontFamily:'Inter,sans-serif', fontWeight: tab===t.id ? 600 : 500, fontSize:13,
              color: tab===t.id ? '#041627' : t.id==='alerts' && alertEvents.length > 0 ? '#3a9f9e' : t.disabled ? '#c4c6cd' : '#44474c',
              marginBottom:-1, transition:'all .15s', whiteSpace:'nowrap',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <span style={{ fontSize:10, opacity: tab===t.id ? 1 : 0.5 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── UPLOAD TAB ───────────────────────────────────────────────────── */}
        {tab === 'upload' && (
          <div className="fadeUp">
            <div style={{ marginBottom:32 }}>
              <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:32, marginBottom:6 }}>Upload Import Data</h1>
              <p style={{ color:'var(--muted)' }}>Upload your Excel file to begin AI-powered cleaning. Each row uses 1 from your quota.</p>
            </div>

            {quota && rowsRemaining === 0 && (
              <div style={{ background:'var(--danger)15', border:'1px solid var(--danger)44', borderRadius:12, padding:'18px 24px', marginBottom:24 }}>
                <strong style={{ color:'var(--danger)' }}>⚠️ You've used all {quota.rows_limit.toLocaleString()} rows.</strong>
                <span style={{ color:'var(--muted)', marginLeft:8, fontSize:14 }}>Contact us to get your quota reset or increased.</span>
              </div>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              style={{ border:`2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius:20, padding:'64px 40px', textAlign:'center', cursor:'pointer', transition:'all .2s', background: dragging ? '#00c2ff08' : 'var(--card)' }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => processFile(e.target.files[0])} />
              <div style={{ fontSize:48, marginBottom:16 }}>{file ? '✅' : '📂'}</div>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:20, marginBottom:8 }}>
                {file ? file.name : 'Drop your Excel file here'}
              </div>
              <div style={{ color:'var(--muted)', fontSize:14 }}>
                {rawRows ? `${rawRows.length} rows detected · Click to change file` : 'or click to browse — .xlsx and .xls supported'}
              </div>
            </div>
            {uploadError && <div style={{ color:'var(--danger)', marginTop:10, fontSize:13 }}>{uploadError}</div>}

            {rawRows && rawRows.length > 0 && (
              <div style={{ marginTop:28 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700 }}>Preview <span style={{ color:'var(--muted)', fontWeight:400, fontSize:13 }}>(first 5 rows)</span></div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <Tag label={`${Object.keys(rawRows[0]).length} columns`} color="var(--accent)" />
                    <Tag label={`${rawRows.length} rows`} color="var(--gold)" />
                    <Tag label={rowsRemaining >= rawRows.length ? '✓ Enough quota' : '✗ Not enough quota'} color={rowsRemaining >= rawRows.length ? 'var(--success)' : 'var(--danger)'} />
                  </div>
                </div>
                <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid var(--border)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'DM Mono, monospace' }}>
                    <thead><tr style={{ background:'var(--surface)' }}>
                      {Object.keys(rawRows[0]).slice(0,7).map(c => (
                        <th key={c} style={{ padding:'10px 14px', textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11 }}>{c}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {rawRows.slice(0,5).map((row,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #1e2d4a22' }}>
                          {Object.keys(rawRows[0]).slice(0,7).map(c => (
                            <td key={c} style={{ padding:'8px 14px', whiteSpace:'nowrap', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }}>{String(row[c]??'')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {quotaError && (
                  <div style={{ marginTop:18, background:'var(--danger)15', border:'1px solid var(--danger)44', borderRadius:12, padding:'18px 24px' }}>
                    <div style={{ color:'var(--danger)', fontWeight:600, marginBottom:4 }}>⚠️ {quotaError.message}</div>
                    <div style={{ color:'var(--muted)', fontSize:13 }}>You have {quotaError.rowsRemaining} rows remaining. Please upload a smaller file.</div>
                  </div>
                )}

                <div style={{ marginTop:28, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
                  <button className="btn btn-gold" onClick={startCleaning}
                    disabled={cleaning || rowsRemaining < rawRows.length}
                    style={{ padding:'14px 40px', fontSize:16 }}>
                    {cleaning ? <><span className="spinner spin" style={{ borderTopColor:'#000' }} /> Cleaning with AI…</> : `🚀 Clean ${rawRows.length} rows`}
                  </button>
                  {rowsRemaining < rawRows.length && !cleaning && (
                    <span style={{ color:'var(--danger)', fontSize:13 }}>File has {rawRows.length} rows but only {rowsRemaining} quota remaining.</span>
                  )}
                </div>

                {cleaning && (
                  <div style={{ marginTop:24, background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <span className="spinner spin" />
                      <span style={{ fontFamily:'DM Mono, monospace', fontSize:13, color:'var(--accent)' }}>Groq LLaMA is processing your data…</span>
                    </div>
                    <div className="quota-bar-track" style={{ overflow:'hidden' }}>
                      <div style={{ height:8, borderRadius:6, width:'40%', background:'linear-gradient(90deg, var(--accent), var(--gold))', animation:'slide 1.4s ease infinite' }} />
                    </div>
                    <style>{`@keyframes slide{0%{margin-left:-40%}100%{margin-left:100%}}`}</style>
                    <div style={{ marginTop:10, fontSize:12, color:'var(--muted)' }}>Typically 30–120 seconds depending on file size. Do not close this tab.</div>
                    <div style={{ marginTop:6, fontSize:12, color:'var(--muted)' }}>⚡ Batching + dedup cache active — duplicate rows reuse results automatically.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── INSIGHTS TAB ─────────────────────────────────────────────────── */}
        {tab === 'insights' && summary && (
          <div className="fadeUp">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32, flexWrap:'wrap', gap:16 }}>
              <div>
                <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:32, marginBottom:6 }}>Summary & Insights</h1>
                <p style={{ color:'var(--muted)' }}>AI-powered analysis of {summary.validRows.toLocaleString()} valid import records</p>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-outline" onClick={() => downloadSummaryExcel(summary)} style={{ padding:'10px 20px' }}>⬇ Export Summary</button>
                <button className="btn btn-gold" onClick={downloadCleaned} style={{ padding:'10px 20px' }}>⬇ Full Data</button>
              </div>
            </div>

            {/* Top KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:16, marginBottom:32 }}>
              <KpiCard label="Total Rows" value={summary.totalRows.toLocaleString()} icon="📋" color="var(--accent)" sub={`${summary.outlierCount} outliers excluded`} />
              <KpiCard label="Total Volume" value={`${(summary.totalVol/1000).toFixed(1)}k MT`} icon="⚖️" color="var(--gold)" sub="metric tonnes" />
              <KpiCard label="Total Value" value={`$${(summary.totalUSD/1000000).toFixed(1)}M`} icon="💵" color="var(--success)" sub="USD (exchange rate)" />
              <KpiCard label="Avg Price" value={summary.avgPrice > 0 ? `$${summary.avgPrice.toFixed(0)}/MT` : 'N/A'} icon="💹" color="var(--accent)"
                sub={summary.avgPrice > 0 ? `Range $${summary.minPrice.toFixed(0)}–$${summary.maxPrice.toFixed(0)}` : ''} />
              <KpiCard label="Data Quality" value={`${(100 - summary.outlierRate).toFixed(1)}%`} icon="✅" color="var(--success)" sub={`${summary.outlierCount} rows flagged`} />
              <KpiCard label="Origin Countries" value={summary.byOrigin.length} icon="🗺️" color="#a78bfa" sub="unique source countries" />
            </div>

            {/* Key Insights grid */}
            <div style={{ marginBottom:32 }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:20, marginBottom:16 }}>🔍 Key Insights</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
                {summary.insights.map((ins, i) => (
                  <InsightCard key={i} {...ins} />
                ))}
              </div>
            </div>

            {/* Monthly Volume Trend */}
            {summary.monthTrend.length > 0 && (
              <div className="card" style={{ marginBottom:24 }}>
                <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:18, marginBottom:20 }}>📅 Monthly Volume Trend (MT)</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120, overflowX:'auto', paddingBottom:8 }}>
                  {summary.monthTrend.map(([month, vol], i) => {
                    const h = summary.maxMonthVol > 0 ? Math.max((vol / summary.maxMonthVol) * 100, 4) : 4
                    return (
                      <div key={month} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:'0 0 auto', minWidth:44 }}>
                        <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{vol > 999 ? `${(vol/1000).toFixed(0)}k` : vol.toFixed(0)}</div>
                        <div style={{ width:32, height:`${h}%`, background:`linear-gradient(to top, var(--accent), var(--gold))`, borderRadius:'4px 4px 0 0', transition:'height .5s ease', opacity: 0.7 + (i / summary.monthTrend.length) * 0.3 }} title={`${month}: ${vol.toFixed(1)} MT`} />
                        <div style={{ fontSize:9, color:'var(--muted)', fontFamily:'DM Mono, monospace', transform:'rotate(-35deg)', transformOrigin:'top center', marginTop:4, whiteSpace:'nowrap' }}>{month}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Two-column breakdown rows */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:20, marginBottom:20 }}>

              {/* Top Products */}
              {summary.topProducts.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>🏷️ Top Products by Volume</div>
                  {summary.topProducts.map(([p, v], i) => (
                    <BarRow key={p} label={p} value={v} total={summary.totalVol} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

              {/* Top Grades */}
              {summary.topGrades && summary.topGrades.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>🔬 Top Product Grades by Volume</div>
                  {summary.topGrades.map(([g, v], i) => (
                    <BarRow key={g} label={g} value={v} total={summary.totalVol} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

              {/* Top Importers */}
              {summary.topImporters.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>🏢 Top Importers by Volume</div>
                  {summary.topImporters.map(([p, v], i) => (
                    <BarRow key={p} label={p} value={v} total={summary.totalVol} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

              {/* Top Suppliers */}
              {summary.topSuppliers.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>🌏 Top Suppliers by Volume</div>
                  {summary.topSuppliers.map(([p, v], i) => (
                    <BarRow key={p} label={p} value={v} total={summary.totalVol} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

              {/* Origin Countries */}
              {summary.byOrigin.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>🗺️ Origin Countries by Volume</div>
                  {summary.byOrigin.map(([p, v], i) => (
                    <BarRow key={p} label={p} value={v} total={summary.totalVol} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

              {/* Ports */}
              {summary.byPort.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>⚓ Indian Ports by Volume</div>
                  {summary.byPort.map(([p, v], i) => (
                    <BarRow key={p} label={p} value={v} total={summary.totalVol} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

              {/* Financial Year */}
              {summary.byFY.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>📆 Volume by Financial Year</div>
                  {summary.byFY.map(([y, v], i) => (
                    <BarRow key={y} label={y} value={v} total={Math.max(...summary.byFY.map(([,v])=>v))} color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" MT" />
                  ))}
                </div>
              )}

            </div>

            <div style={{ textAlign:'center', marginTop:8 }}>
              <button className="btn btn-outline" onClick={() => { setTab('upload'); setFile(null); setRawRows(null); setCleanedRows(null) }}>
                ← Clean Another File
              </button>
            </div>
          </div>
        )}

        {/* ── DATA TABLE TAB ───────────────────────────────────────────────── */}
        {tab === 'results' && cleanedRows && (
          <div className="fadeUp">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:16 }}>
              <div>
                <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:32, marginBottom:6 }}>Cleaned Data Table</h1>
                <p style={{ color:'var(--muted)' }}>{cleanedRows.length} rows · first 20 shown below</p>
              </div>
              <button className="btn btn-gold" onClick={downloadCleaned} style={{ padding:'12px 28px', fontSize:15 }}>⬇ Download Full Excel</button>
            </div>

            {cleanStats && (
              <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
                <Tag label={`${cleanStats.rowsUsed} rows used`} color="var(--accent)" />
                <Tag label={`${cleanStats.rowsRemaining} remaining`} color="var(--success)" />
                <Tag label={`${cleanStats.apiCallsMade} Groq calls`} color="var(--gold)" />
                <Tag label={`~${cleanStats.cacheSavings} calls saved`} color="var(--muted)" />
              </div>
            )}

            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'DM Mono, monospace' }}>
                  <thead><tr style={{ background:'var(--surface)' }}>
                    {displayCols.map(c => (
                      <th key={c} style={{ padding:'10px 14px', textAlign:'left', color: newCols.includes(c) ? 'var(--accent)' : 'var(--muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', fontSize:11 }}>{c}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {cleanedRows.slice(0,20).map((row,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #1e2d4a22', background: row.Outlier==='Yes' ? '#ff4d6d08' : 'transparent' }}>
                        {displayCols.map(c => (
                          <td key={c} style={{ padding:'8px 14px', color: c==='Outlier' ? (row[c]==='Yes'?'var(--danger)':'var(--success)') : 'var(--text)', whiteSpace:'nowrap', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis' }}>
                            {String(row[c]??'')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ marginTop:20, textAlign:'center' }}>
              <button className="btn btn-outline" onClick={() => setTab('insights')}>← Back to Insights</button>
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ───────────────────────────────────────────────────── */}
        {tab === 'alerts' && (
          <div className="fadeUp">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, flexWrap:'wrap', gap:16 }}>
              <div>
                <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:32, marginBottom:6 }}>Price & Competitor Alerts</h1>
                <p style={{ color:'var(--muted)' }}>Set watches on any product, importer, or price. Fires automatically when you clean matching data.</p>
              </div>
            </div>

            {/* Unread alert events */}
            {alertEvents.length > 0 && (
              <div style={{ marginBottom:28 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:18, color:'var(--gold)' }}>
                    🔔 {alertEvents.length} New Alert{alertEvents.length > 1 ? 's' : ''}
                  </div>
                  <button className="btn btn-ghost" onClick={markAllRead} style={{ padding:'6px 16px', fontSize:12 }}>Mark all read</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {alertEvents.map(ev => (
                    <div key={ev.id} style={{ background:'var(--gold)10', border:'1px solid var(--gold)44', borderRadius:12, padding:'14px 18px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                        <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:14 }}>
                          {ev.matched_product || 'Product'}{ev.matched_grade ? ` · ${ev.matched_grade}` : ''}
                        </div>
                        <Tag label={new Date(ev.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} color="var(--muted)" />
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {ev.matched_importer && <Tag label={`Importer: ${ev.matched_importer}`} color="var(--accent)" />}
                        {ev.matched_supplier && <Tag label={`Supplier: ${ev.matched_supplier}`} color="var(--success)" />}
                        {ev.matched_price_usd && <Tag label={`$${parseFloat(ev.matched_price_usd).toFixed(0)}/MT`} color="var(--gold)" />}
                        {ev.matched_volume_mt && <Tag label={`${parseFloat(ev.matched_volume_mt).toFixed(1)} MT`} color="var(--muted)" />}
                        {ev.matched_origin && <Tag label={ev.matched_origin} color="var(--muted)" />}
                        {ev.source_filename && <Tag label={ev.source_filename} color="var(--muted)" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create new watch form */}
            <div className="card" style={{ marginBottom:24 }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, marginBottom:18 }}>➕ Create New Watch</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:16 }}>
                {[
                  { key:'name',           label:'Watch Name *',       placeholder:'e.g. Carbon Black competitors' },
                  { key:'product',        label:'Product (optional)',  placeholder:'e.g. Carbon Black' },
                  { key:'grade',          label:'Grade (optional)',    placeholder:'e.g. N330' },
                  { key:'importer',       label:'Importer (optional)', placeholder:'e.g. Reliance Industries' },
                  { key:'supplier',       label:'Supplier (optional)', placeholder:'e.g. Birla Carbon' },
                  { key:'origin_country', label:'Origin Country',      placeholder:'e.g. China' },
                  { key:'indian_port',    label:'Indian Port',         placeholder:'e.g. Nhava Sheva' },
                  { key:'price_below_usd', label:'Alert if Price below ($/MT)', placeholder:'e.g. 900' },
                  { key:'price_above_usd', label:'Alert if Price above ($/MT)', placeholder:'e.g. 1200' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:5, fontFamily:'DM Mono, monospace', letterSpacing:1 }}>{f.label.toUpperCase()}</label>
                    <input className="input-field" value={newWatch[f.key]} onChange={e => setNewWatch(w => ({ ...w, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:8 }}>
                  {['import','export'].map(t => (
                    <button key={t} onClick={() => setNewWatch(w => ({ ...w, watch_type: t }))} style={{
                      padding:'6px 16px', borderRadius:6, border:`1px solid ${newWatch.watch_type === t ? 'var(--accent)' : 'var(--border)'}`,
                      background: newWatch.watch_type === t ? 'var(--accent)' : 'transparent',
                      color: newWatch.watch_type === t ? '#000' : 'var(--muted)',
                      fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:12, cursor:'pointer',
                    }}>{t.toUpperCase()}</button>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={saveWatch} disabled={watchSaving} style={{ padding:'10px 24px' }}>
                  {watchSaving ? 'Saving…' : '💾 Save Watch'}
                </button>
                {watchError && <span style={{ color:'var(--danger)', fontSize:13 }}>{watchError}</span>}
              </div>
            </div>

            {/* Existing watches */}
            <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:18, marginBottom:14 }}>
              Active Watches ({watches.filter(w => w.is_active).length})
            </div>
            {watches.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔕</div>
                <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, marginBottom:8 }}>No watches set up yet</div>
                <div style={{ color:'var(--muted)', fontSize:14 }}>Create a watch above. It will fire automatically every time you clean a file that contains matching data.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {watches.map(w => (
                  <div key={w.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, padding:'16px 20px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15 }}>{w.name}</span>
                        <Tag label={w.watch_type.toUpperCase()} color="var(--accent)" />
                        {!w.is_active && <Tag label="PAUSED" color="var(--muted)" />}
                        {w.trigger_count > 0 && <Tag label={`Fired ${w.trigger_count}×`} color="var(--gold)" />}
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {w.product        && <Tag label={`Product: ${w.product}`}    color="var(--muted)" />}
                        {w.grade          && <Tag label={`Grade: ${w.grade}`}        color="var(--muted)" />}
                        {w.importer       && <Tag label={`Importer: ${w.importer}`}  color="var(--muted)" />}
                        {w.supplier       && <Tag label={`Supplier: ${w.supplier}`}  color="var(--muted)" />}
                        {w.origin_country && <Tag label={`Country: ${w.origin_country}`} color="var(--muted)" />}
                        {w.indian_port    && <Tag label={`Port: ${w.indian_port}`}   color="var(--muted)" />}
                        {w.price_below_usd && <Tag label={`< $${w.price_below_usd}/MT`} color="var(--success)" />}
                        {w.price_above_usd && <Tag label={`> $${w.price_above_usd}/MT`} color="var(--danger)" />}
                      </div>
                    </div>
                    <button onClick={() => deleteWatch(w.id)} style={{ background:'var(--danger)22', border:`1px solid var(--danger)44`, color:'var(--danger)', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:12, fontFamily:'DM Mono, monospace' }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop:24, background:'var(--surface)', borderRadius:12, padding:'16px 20px', fontSize:13, color:'var(--muted)', lineHeight:1.7 }}>
              💡 <strong style={{ color:'var(--text)' }}>How alerts work:</strong> Every time you upload and clean a file, the system checks all your active watches against the cleaned rows. If any row matches your criteria (product name contains your text, importer contains your text, and price is within your threshold), a new alert fires instantly and appears here. The more files you and other users clean, the more timely your alerts become.
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="fadeUp">
            <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:32, marginBottom:6 }}>Usage History</h1>
            <p style={{ color:'var(--muted)', marginBottom:32 }}>Your cleaning jobs and quota usage</p>
            {quota && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(155px, 1fr))', gap:16, marginBottom:24 }}>
                  <KpiCard label="Rows Remaining" value={rowsRemaining.toLocaleString()} color="var(--accent)" />
                  <KpiCard label="Rows Used"      value={quota.rows_used.toLocaleString()} color="var(--gold)" />
                  <KpiCard label="Total Quota"    value={quota.rows_limit.toLocaleString()} color="var(--muted)" />
                  <KpiCard label="Jobs Run"       value={history.length} color="var(--success)" />
                </div>
                <div className="card" style={{ marginBottom:24 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, fontSize:14 }}>
                    <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700 }}>Quota Usage</span>
                    <span style={{ fontFamily:'DM Mono, monospace', fontSize:13, color:quotaColor }}>{quota.rows_used.toLocaleString()} / {quota.rows_limit.toLocaleString()} ({quotaPct.toFixed(1)}%)</span>
                  </div>
                  <div className="quota-bar-track" style={{ height:12 }}>
                    <div className="quota-bar-fill" style={{ width:`${quotaPct}%`, background:quotaColor, height:'100%' }} />
                  </div>
                </div>
              </>
            )}
            {history.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:48 }}>
                <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
                <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, marginBottom:8 }}>No cleaning jobs yet</div>
                <div style={{ color:'var(--muted)', fontSize:14, marginBottom:20 }}>Upload a file to get started</div>
                <button className="btn btn-primary" onClick={() => setTab('upload')}>Upload File</button>
              </div>
            ) : (
              <div className="card" style={{ padding:0, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'var(--surface)' }}>
                    {['File','Rows Cleaned','Date'].map(h => (
                      <th key={h} style={{ padding:'12px 20px', textAlign:'left', color:'var(--muted)', borderBottom:'1px solid var(--border)', fontSize:11, fontFamily:'DM Mono, monospace', letterSpacing:1 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {history.map(row => (
                      <tr key={row.id} style={{ borderBottom:'1px solid #1e2d4a22' }}>
                        <td style={{ padding:'12px 20px', fontFamily:'DM Mono, monospace', fontSize:12 }}>{row.filename||'—'}</td>
                        <td style={{ padding:'12px 20px' }}><Tag label={`${row.rows_cleaned} rows`} color="var(--accent)" /></td>
                        <td style={{ padding:'12px 20px', color:'var(--muted)', fontSize:12, fontFamily:'DM Mono, monospace' }}>
                          {(() => { const d = new Date(row.created_at); const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}` })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Trade News Panel ───────────────────────────────────────── */}
            <DashboardNewsPanel />
          </div>
        )}

      </div>
    </>
  )
}

// ── Inline news panel for dashboard ──────────────────────────────────────────
// Fetches latest 6 news items client-side for logged-in users
const CAT_COLORS = {
  Policy:    '#378ADD', Tariff: '#BA7517', Commodity: '#1D9E75',
  Market:    '#7F77DD', Port:   '#D85A30',
}

function DashboardNewsPanel() {
  const [news, setNews] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/news?limit=6')
      .then(r => r.json())
      .then(d => { setNews(d.news || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || news.length === 0) return null

  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:18 }}>📰 Trade News Flash</div>
        <a href="/" target="_blank" rel="noopener" style={{ fontSize:12, color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>View all →</a>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
        {news.map(item => {
          const color = CAT_COLORS[item.category] || 'var(--accent)'
          const d = new Date(item.published_at)
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          const date = `${d.getDate()} ${months[d.getMonth()]}`
          return (
            <div key={item.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ background:color+'22', color, border:`1px solid ${color}44`, borderRadius:4, padding:'1px 7px', fontSize:10, fontFamily:'DM Mono, monospace' }}>
                  {item.category.toUpperCase()}
                </span>
                <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{date}</span>
              </div>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:13, lineHeight:1.4, marginBottom:6 }}>{item.headline}</div>
              <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>{item.summary.slice(0,120)}…</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
