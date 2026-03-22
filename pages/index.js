import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// ── Design tokens — precomputed so NO template literals are needed in JSX ─────
const primary          = '#041627'
const primaryContainer = '#1a2b3c'
const onPrimaryContainer = '#8192a7'
const secondary        = '#436180'
const secondaryContainer = '#bcdafe'
const onSecondaryContainer = '#42607f'
const tertiaryContainer = '#002f2f'
const onTertiaryContainer = '#3a9f9e'
const tertiaryFixed    = '#93f2f2'
const tertiaryFixedDim = '#76d6d5'
const error            = '#ba1a1a'
const errorContainer   = '#ffdad6'
const surface          = '#f7f9fb'
const surfaceLowest    = '#ffffff'
const surfaceLow       = '#f2f4f6'
const surfaceContainer = '#eceef0'
const surfaceHigh      = '#e6e8ea'
const onSurface        = '#191c1e'
const onSurfaceVariant = '#44474c'
const outline          = '#74777d'
const outlineVariant   = '#c4c6cd'
const sky              = '#0ea5e9'

// Precomputed border strings — avoids template literals inside JSX style props
const bSky       = '1px solid #0ea5e9'
const bHigh      = '1px solid #e6e8ea'
const bLow       = '1px solid #f2f4f6'
const bVariant   = '1px solid #c4c6cd'
const bVariant30 = '1px solid rgba(196,198,205,0.3)'
const bDashed    = '1px dashed #c4c6cd'
const bError     = '1px solid #ba1a1a'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(iso) {
  const d = new Date(iso)
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()
}
function commas(n) {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const CAT_COLOR = {
  Policy: '#0ea5e9', Tariff: '#f59e0b',
  Commodity: '#3a9f9e', Market: '#436180', Port: '#ba1a1a',
}

const DEMO_ROWS = [
  { raw:'CARBON BLACK N-330 RUBBER GRADE TYRE MFG', product:'Carbon Black', grade:'N330',   ok:true  },
  { raw:'PALM OLEIN RBD IN FLEXIBAGS',              product:'Palm Oil',     grade:'RBD',    ok:true  },
  { raw:'AIR CARGO SILICON WAFER GRADE A',          product:'—',            grade:'—',      ok:false },
  { raw:'HR STEEL COIL IS2062 E250 2MM THK',        product:'Steel',        grade:'IS2062', ok:true  },
  { raw:'HDPE GRANULES BLOW MOULDING GRADE 6200B',  product:'HDPE',         grade:'6200B',  ok:true  },
]

const BEFORE_AFTER = [
  { field:'Importer',     before:'RELIANCE IND LTD',                                  after:'Reliance Industries Limited' },
  { field:'Shipper',      before:'HANGZHOU JLS FLAME RETARDANTS CHEMI CALS CO LTD',   after:'Hangzhou JLS Flame Retardants Chemical Co. Ltd' },
  { field:'Product',      before:'CARBON BLACK N-330 RUBBER GRADE FOR TYRE MFG',      after:'Carbon Black · Grade N330' },
  { field:'Vols & Price', before:'1300 KGS @ $4.793/KG',                              after:'1.3 MT @ $918/MT' },
]

const PILLARS = [
  { color:sky,              icon:'🏢', label:'Importers', desc:'Normalize 50 name variations to one official entity for clean market share analysis' },
  { color:tertiaryFixedDim, icon:'🌏', label:'Shippers',  desc:'Resolve foreign supplier names and addresses to canonical entities across shipments' },
  { color:onTertiaryContainer, icon:'🏷️', label:'Products', desc:'Classify raw descriptions into Product + Grade — e.g. Flame Retardant · JLS-FR332' },
]

const STATS = [
  { end:18200000, suffix:'+', label:'Active IEC Holders in India',  sub:'+2.8L new registrations/yr' },
  { end:8,        suffix:'',  label:'Cleaning Rules Automated',      sub:'Outlier, FY, Vol, Price, Grade…' },
  { end:70,       suffix:'%', label:'Fewer AI API Calls',            sub:'Dedup cache across duplicate rows' },
  { end:100,      suffix:'',  label:'Rows Always Free',              sub:'No credit card, no expiry' },
]

const STEPS = [
  { n:'01', title:'Upload your Excel file',        desc:'Drag and drop any .xlsx with Indian customs data. Works with SEAIR, Zauba, IceGate, DGFT direct downloads. Auto-detects column names, sheet, and junk header rows.' },
  { n:'02', title:'AI applies 8 cleaning rules',   desc:'Outlier flagging, Month/FY mapping, Vols (MT), Price ($/MT), Product + Grade classification, Importer normalization, Supplier normalization — one pass, all rows.' },
  { n:'03', title:'Download clean data + insights', desc:'Cleaned Excel with 8 new columns. Summary dashboard with importers, suppliers, countries, ports, monthly volume, FY comparison. Set competitor price alerts.' },
]

const PLANS = [
  { name:'Free',     rows:'100',    price:'₹0',     per:'Always free',  popular:false },
  { name:'Starter',  rows:'1,000',  price:'₹999',   per:'₹1.00/row',   popular:false },
  { name:'Business', rows:'5,000',  price:'₹3,499', per:'₹0.70/row',   popular:true  },
  { name:'Pro',      rows:'20,000', price:'₹8,999', per:'₹0.45/row',   popular:false },
]

const COMP_ROWS = [
  ['AI product + grade classification', '✗', '✗', '✓'],
  ['Importer & shipper normalization',  '✗', '✗', '✓'],
  ['Outlier detection',                 '✗', '✗', '✓'],
  ['Price $/MT auto-calculated',        '✗', '✗', '✓'],
  ['Competitor price alerts',           '✗', 'Partial', '✓'],
  ['Export data cleaning',              'Manual', 'Data only', '✓'],
  ['Monthly cost',                      'Analyst ₹30K+', '₹1.5K–6.5K', '₹0–8,999'],
]

const SEO_TAGS = [
  'Carbon Black Import India','Palm Oil Import Duty','Steel Anti-Dumping India',
  'DGFT FTP 2023-28','India China Trade Balance','Nhava Sheva Port',
  'HS Code Classification Tool','Customs Data Cleaning','BCD Rate Changes 2025',
  'India Trade Deficit FY25','Chemical Import Duty India','IGST on Imports',
  'FOB Price Export India','India ASEAN FTA','IEC Registration DGFT',
]

// ── CSS — hardcoded hex only, no JS interpolation ─────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#f7f9fb;color:#191c1e;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button,input{font-family:inherit}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#d8dadc;border-radius:10px}
.tabular{font-variant-numeric:tabular-nums}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes glow{0%,100%{box-shadow:0 0 0 3px rgba(14,165,233,0.12)}50%{box-shadow:0 0 0 5px rgba(14,165,233,0.25)}}
.fadeUp{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
.btn-primary{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;background:linear-gradient(135deg,#041627,#1a2b3c);color:#fff;border:none;border-radius:4px;font-family:'Inter',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:opacity .15s;text-decoration:none}
.btn-primary:hover{opacity:.88}
.btn-ghost{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:transparent;color:#191c1e;border:1px solid rgba(196,198,205,.5);border-radius:4px;font-family:'Inter',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .15s;text-decoration:none}
.btn-ghost:hover{border-color:#0ea5e9;color:#0ea5e9}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:9px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.chip-ok{background:#002f2f;color:#76d6d5}
.chip-bad{background:#ffdad6;color:#93000a}
.chip-info{background:#bcdafe;color:#42607f}
.lbl{font-size:9px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#44474c}
@media(max-width:900px){
  .hero-grid{flex-direction:column!important}
  .pillars{flex-direction:column!important}
  .value-row{flex-wrap:wrap!important}
  .step-grid{grid-template-columns:1fr!important}
  .price-grid{grid-template-columns:1fr 1fr!important}
  .nav-links{display:none!important}
  .news-grid{grid-template-columns:1fr!important}
  .cta-row{flex-direction:column!important}
  .comp-col2{display:none!important}
  .stat-border{border-left:none!important}
}
@media(max-width:600px){
  .price-grid{grid-template-columns:1fr!important}
}
`

// ── StatCounter ───────────────────────────────────────────────────────────────
function StatBlock({ end, suffix, label, sub, showBorder }) {
  const [val, setVal] = useState(end)
  const ref = useRef()
  const done = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return
      done.current = true; obs.disconnect()
      let s = 0
      const run = () => {
        s += 16
        const p = Math.min(s / 1400, 1)
        setVal(Math.floor((1 - Math.pow(1 - p, 3)) * end))
        if (p < 1) requestAnimationFrame(run)
      }
      setVal(0); requestAnimationFrame(run)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [end])

  return (
    <div ref={ref} className={showBorder ? 'stat-border' : ''}
      style={{ flex: 1, padding: '0 28px', borderLeft: showBorder ? bHigh : 'none', minWidth: 0 }}>
      <div className="lbl" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary, lineHeight: 1, marginBottom: 6 }}>
        {commas(val)}{suffix}
      </div>
      {sub && <div style={{ fontSize: 11, color: sky, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{sub}</div>}
    </div>
  )
}

// ── NewsCard ──────────────────────────────────────────────────────────────────
function NewsCard({ item }) {
  const color = CAT_COLOR[item.category] || sky
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? surfaceLow : surfaceLowest,
        padding: '20px 24px',
        transition: 'background .15s',
        borderLeft: hov ? ('3px solid ' + color) : '3px solid transparent',
        cursor: 'default',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', background: color + '18', color, padding: '3px 8px', borderRadius: 100 }}>
          {item.category}
        </span>
        <span style={{ fontSize: 10, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif' }}>
          {fmtDate(item.published_at)}
        </span>
      </div>
      <div style={{ fontSize: 13, fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: primary, lineHeight: 1.4, marginBottom: 6 }}>
        {item.headline}
      </div>
      <div style={{ fontSize: 12, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>
        {item.summary}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [newsTab, setNewsTab] = useState('All')
  const [news, setNews] = useState([])
  const categories = ['All', 'Policy', 'Tariff', 'Commodity', 'Market', 'Port']
  const filtered = newsTab === 'All' ? news : news.filter(n => n.category === newsTab)

  useEffect(() => {
    fetch('/api/news?limit=12').then(r => r.json()).then(d => setNews(d.news || [])).catch(() => {})
  }, [])

  return (
    <div>
      <Head>
        <title>Trade Intelligence — India Import Export Data Cleaning Platform</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI-powered import export data cleaning for Indian customs. Clean shipper names, importer records, product classifications and price per MT from raw DGFT Excel files." />
        <meta name="keywords" content="India import data cleaning, export shipper normalization, importer data cleaning, DGFT customs tool, HS code classification, trade intelligence India" />
        <meta property="og:title" content="Trade Intelligence — Enterprise Import Export Data Cleaning" />
        <meta property="og:description" content="Clean shipper, importer and product data from raw customs files. AI-powered. Free for 100 rows." />
        <link rel="canonical" href={process.env.NEXT_PUBLIC_APP_URL || ''} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(247,249,251,0.92)', backdropFilter: 'blur(12px)', borderBottom: bHigh, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div>
            <div style={{ fontSize: 15, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary, letterSpacing: '-.01em' }}>Trade Intelligence</div>
            <div className="lbl">Enterprise Ledger</div>
          </div>
          <nav className="nav-links" style={{ display: 'flex' }}>
            {['Platform', 'Pricing', 'Trade News'].map(l => (
              <a key={l} href={l === 'Trade News' ? '#news' : l === 'Pricing' ? '#pricing' : '#how'}
                style={{ fontSize: 13, fontFamily: 'Inter,sans-serif', fontWeight: 500, color: onSurfaceVariant, padding: '0 16px', lineHeight: '56px', display: 'block' }}>
                {l}
              </a>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: sky }}>Live</span>
          </div>
          <Link href="/login"  className="btn-ghost"   style={{ padding: '8px 18px', fontSize: 12 }}>Login</Link>
          <Link href="/signup" className="btn-primary" style={{ padding: '8px 18px', fontSize: 12 }}>Start Free</Link>
        </div>
      </header>

      {/* SCREEN 1 — HERO */}
      <div style={{ background: surface, borderBottom: bHigh }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 40px 64px' }}>
          <div className="hero-grid" style={{ display: 'flex', gap: 64, alignItems: 'flex-start' }}>

            {/* Left — headline */}
            <div style={{ flex: '1 1 520px', minWidth: 0 }}>
              <div className="fadeUp" style={{ marginBottom: 16 }}>
                <span className="chip chip-ok">✦ India EXIM Intelligence Platform</span>
              </div>
              <h1 className="fadeUp" style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 'clamp(32px,3.5vw,52px)', lineHeight: 1.08, color: primary, marginBottom: 20, letterSpacing: '-.02em', animationDelay: '.06s' }}>
                AI-Cleaned Data for<br />
                <span style={{ color: sky }}>Shippers, Importers</span><br />
                <span style={{ color: onTertiaryContainer }}>&amp; Products</span>
              </h1>
              <p className="fadeUp" style={{ fontSize: 15, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', lineHeight: 1.8, marginBottom: 28, maxWidth: 500, animationDelay: '.12s' }}>
                Raw DGFT customs files contain messy shipper names, inconsistent importer records, and unclassified products. Trade Intelligence applies 8 AI cleaning rules — normalizing every entity, extracting grades, calculating price per MT — and delivers analysis-ready data in minutes.
              </p>

              {/* Three pillars */}
              <div className="pillars fadeUp" style={{ display: 'flex', gap: 12, marginBottom: 32, animationDelay: '.18s' }}>
                {PILLARS.map(p => (
                  <div key={p.label} style={{ background: surfaceLowest, padding: '16px 14px', borderTop: '2px solid ' + p.color, flex: 1 }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{p.icon}</div>
                    <div style={{ fontSize: 12, fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: primary, marginBottom: 4 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>{p.desc}</div>
                  </div>
                ))}
              </div>

              <div className="fadeUp" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', animationDelay: '.24s' }}>
                <Link href="/signup" className="btn-primary" style={{ fontSize: 14, padding: '13px 28px', animation: 'glow 3s ease-in-out infinite' }}>
                  Clean Your First File Free →
                </Link>
                <a href="#how" className="btn-ghost" style={{ fontSize: 13 }}>How It Works ↓</a>
              </div>
              <div className="fadeUp" style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap', animationDelay: '.28s' }}>
                {['✓ Free 100 rows', '✓ No credit card', '✓ Import & Export data', '✓ All Indian ports'].map(t => (
                  <span key={t} style={{ fontSize: 11, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif' }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Right — live demo table */}
            <div className="fadeUp" style={{ flex: '0 0 auto', width: 'min(100%,500px)', animationDelay: '.2s' }}>
              <div style={{ background: surfaceLowest, border: bHigh }}>
                <div style={{ padding: '12px 20px', borderBottom: bLow, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
                  <span className="lbl">Live Demo — Before vs After</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: surfaceLow }}>
                        {['Raw Description', 'Product', 'Grade', 'Status'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: onSurfaceVariant, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_ROWS.map((r, i) => (
                        <tr key={i} style={{ background: r.ok ? 'transparent' : '#ffdad620', borderBottom: bLow }}>
                          <td style={{ padding: '9px 14px', color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{r.raw}</td>
                          <td style={{ padding: '9px 14px', fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: r.ok ? primary : onSurfaceVariant, whiteSpace: 'nowrap', fontSize: 11 }}>{r.product}</td>
                          <td style={{ padding: '9px 14px', fontFamily: 'Inter,sans-serif', color: sky, fontWeight: 600, fontSize: 11 }}>{r.grade}</td>
                          <td style={{ padding: '9px 14px' }}>
                            {r.ok
                              ? <span className="chip chip-ok">Valid</span>
                              : <span className="chip chip-bad">Outlier</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '10px 20px', background: surfaceLow }}>
                  <span style={{ fontSize: 10, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif' }}>
                    Air-cargo flagged · Grades extracted · Companies normalized
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stat bar */}
          <div style={{ display: 'flex', marginTop: 48, borderTop: bHigh, paddingTop: 48, flexWrap: 'wrap', gap: 0 }}>
            {STATS.map((s, i) => (
              <StatBlock key={s.label} end={s.end} suffix={s.suffix} label={s.label} sub={s.sub} showBorder={i !== 0} />
            ))}
          </div>
        </div>
      </div>

      {/* SCREEN 2 — WHAT GETS CLEANED */}
      <div style={{ background: surfaceLow }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="lbl" style={{ marginBottom: 10 }}>What Gets Cleaned</div>
              <h2 style={{ fontSize: 28, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary, letterSpacing: '-.01em' }}>
                Three entities. Eight rules.<br />One clean file.
              </h2>
            </div>
            <p style={{ fontSize: 13, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', maxWidth: 400, lineHeight: 1.7 }}>
              Every Indian customs file has the same problems. Messy shippers, ambiguous products, incorrect units. We fix all of them automatically.
            </p>
          </div>

          {/* Value cards */}
          <div className="value-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { accent: sky,              icon: '🏢', title: 'Importer Intelligence',       desc: '"Reliance Ind Ltd", "RELIANCE INDUSTRIES", "Reliance Ind." — all normalized to one official company name. Enables clean market share analysis across thousands of rows.' },
              { accent: tertiaryFixedDim, icon: '🌏', title: 'Shipper Normalization',       desc: 'Foreign supplier names in raw customs data are inconsistently formatted across shipments. AI matches name + address to canonical supplier entities.' },
              { accent: onTertiaryContainer, icon: '🏷️', title: 'Product + Grade Classification', desc: '"HALOGEN FREE FLAME RETARDANT POLYSTYRENE BASED ELASTOMER ERPCODE MEAAQ..." → Product: Flame Retardant · Grade: JLS-FR332. One field, analysis-ready.' },
              { accent: error,            icon: '🔍', title: 'Outlier Detection',            desc: 'Air-port shipments and non-standard units (anything other than KGS or MTS) are automatically flagged so your volume and price calculations stay accurate.' },
            ].map(c => (
              <div key={c.title} style={{ background: surfaceLowest, padding: '28px 24px', borderTop: '3px solid ' + c.accent, flex: '1 1 220px' }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{c.icon}</div>
                <div style={{ fontSize: 14, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary, marginBottom: 8 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', lineHeight: 1.7 }}>{c.desc}</div>
              </div>
            ))}
          </div>

          {/* How it works + before/after */}
          <div id="how" className="step-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 64 }}>
            <div>
              <div className="lbl" style={{ marginBottom: 24 }}>How It Works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {STEPS.map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: primaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span style={{ fontSize: 12, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: onPrimaryContainer }}>{s.n}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: primary, marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', lineHeight: 1.65 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Before / After */}
            <div>
              <div className="lbl" style={{ marginBottom: 24 }}>Why It Matters</div>
              <div style={{ background: surfaceLowest, padding: '28px 24px' }}>
                {BEFORE_AFTER.map((r, i) => (
                  <div key={r.field} style={{ paddingBottom: i !== 3 ? 16 : 0, marginBottom: i !== 3 ? 16 : 0, borderBottom: i !== 3 ? bLow : 'none' }}>
                    <div className="lbl" style={{ color: sky, marginBottom: 6 }}>{r.field}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, fontSize: 11, fontFamily: 'Inter,sans-serif', color: error, background: '#ffdad640', padding: '4px 8px', borderRadius: 2, wordBreak: 'break-word' }}>{r.before}</div>
                      <div style={{ fontSize: 11, color: onSurfaceVariant, alignSelf: 'center', flexShrink: 0 }}>→</div>
                      <div style={{ flex: 1, fontSize: 11, fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: primary, background: tertiaryFixed + '30', padding: '4px 8px', borderRadius: 2 }}>{r.after}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SCREEN 3 — PRICING */}
      <div id="pricing" style={{ background: surface, borderTop: bHigh, borderBottom: bHigh }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 40px' }}>
          <div style={{ marginBottom: 40 }}>
            <div className="lbl" style={{ marginBottom: 10 }}>Pricing</div>
            <h2 style={{ fontSize: 26, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary }}>Per-row pricing. Credits never expire.</h2>
          </div>

          <div className="price-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
            {PLANS.map((p, i) => (
              <Link href="/signup" key={p.name} style={{
                display: 'block',
                background: p.popular ? primaryContainer : surfaceLowest,
                padding: '28px 24px',
                borderTop: p.popular ? ('3px solid ' + sky) : ('3px solid ' + outline),
                borderRight: i !== 3 ? bLow : 'none',
                textDecoration: 'none',
                position: 'relative',
              }}>
                {p.popular && (
                  <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 8, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', background: sky, color: '#fff', padding: '2px 8px', borderRadius: 100 }}>
                    Popular
                  </div>
                )}
                <div style={{ fontSize: 11, fontFamily: 'Inter,sans-serif', fontWeight: 700, color: p.popular ? onPrimaryContainer : onSurfaceVariant, marginBottom: 10, letterSpacing: '.04em' }}>{p.name}</div>
                <div style={{ fontSize: 28, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: p.popular ? '#fff' : primary, marginBottom: 4 }}>{p.price}</div>
                <div style={{ fontSize: 11, color: p.popular ? onPrimaryContainer : onSurfaceVariant, fontFamily: 'Inter,sans-serif', marginBottom: 12 }}>/month · {p.rows} rows</div>
                <div style={{ fontSize: 11, fontFamily: 'Inter,sans-serif', fontWeight: 600, color: p.popular ? tertiaryFixed : sky }}>{p.per}</div>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '18px 24px', background: surfaceLow, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif' }}>Running a CHA firm or research agency? One account, unlimited clients.</span>
            <Link href="/signup" className="btn-primary" style={{ fontSize: 12, padding: '9px 20px' }}>Talk to us about Agency pricing →</Link>
          </div>
        </div>
      </div>

      {/* SCREEN 4 — TRADE NEWS */}
      <div id="news" style={{ background: surfaceLow }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="lbl" style={{ marginBottom: 10 }}>Daily Briefing</div>
              <h2 style={{ fontSize: 24, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary }}>India Trade Intelligence Feed</h2>
              <p style={{ fontSize: 12, color: onSurfaceVariant, fontFamily: 'Inter,sans-serif', marginTop: 4 }}>Policy changes, tariff updates, commodity movements. Updated daily.</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(cat => {
                const catColor = CAT_COLOR[cat] || sky
                const active = newsTab === cat
                return (
                  <button key={cat} onClick={() => setNewsTab(cat)} style={{
                    padding: '5px 14px',
                    border: active ? ('1px solid ' + catColor) : bVariant,
                    background: active ? catColor + '14' : 'transparent',
                    color: active ? catColor : onSurfaceVariant,
                    borderRadius: 100, fontSize: 10, fontFamily: 'Inter,sans-serif',
                    fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'all .15s',
                  }}>
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', background: surfaceLowest, border: bDashed }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>📰</div>
              <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: primary, marginBottom: 6 }}>News updates daily</div>
              <div style={{ fontSize: 12, color: onSurfaceVariant }}>
                <Link href="/signup" style={{ color: sky, fontWeight: 600 }}>Sign up</Link> to get trade alerts in your dashboard.
              </div>
            </div>
          ) : (
            <div className="news-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 2 }}>
              {filtered.map(item => <NewsCard key={item.id} item={item} />)}
            </div>
          )}

          <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SEO_TAGS.map(tag => (
              <span key={tag} style={{ fontSize: 10, fontFamily: 'Inter,sans-serif', color: onSurfaceVariant, background: surfaceLowest, border: bVariant30, padding: '3px 10px', borderRadius: 2 }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* SCREEN 5 — COMPARISON + CTA */}
      <div style={{ background: surface, borderTop: bHigh }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 40px' }}>
          <div style={{ marginBottom: 32 }}>
            <div className="lbl" style={{ marginBottom: 10 }}>Competitive Landscape</div>
            <h2 style={{ fontSize: 24, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: primary }}>What your current options can't do</h2>
          </div>

          <div style={{ background: surfaceLowest, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: surfaceLow }}>
                  {['Capability', 'Manual Excel', 'Zauba / SEAIR', 'Trade Intelligence'].map((h, i) => (
                    <th key={h}
                      className={i === 1 ? 'comp-col2' : ''}
                      style={{
                        padding: '12px 20px',
                        textAlign: i === 0 ? 'left' : 'center',
                        fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700,
                        letterSpacing: '.1em', textTransform: 'uppercase',
                        color: i === 3 ? primary : onSurfaceVariant,
                        borderBottom: bHigh,
                      }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMP_ROWS.map(([feat, ...vals], ri) => (
                  <tr key={feat} style={{ borderBottom: bLow, background: ri % 2 === 0 ? 'transparent' : surfaceLow + '66' }}>
                    <td style={{ padding: '11px 20px', fontFamily: 'Inter,sans-serif', fontWeight: 500, color: onSurface, fontSize: 12 }}>{feat}</td>
                    {vals.map((v, i) => (
                      <td key={i}
                        className={i === 0 ? 'comp-col2' : ''}
                        style={{
                          padding: '11px 20px', textAlign: 'center',
                          fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: 13,
                          color: v === '✓' ? onTertiaryContainer : v === '✗' ? error : i === 1 ? primary : onSurfaceVariant,
                        }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA bar */}
          <div className="cta-row" style={{ marginTop: 40, background: primaryContainer, padding: '32px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 20, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                Your next file: <span style={{ color: tertiaryFixed }}>3 minutes</span> not 6 hours.
              </div>
              <div style={{ fontSize: 12, color: onPrimaryContainer, fontFamily: 'Inter,sans-serif' }}>
                100 rows free · No credit card · Import and Export both supported · 2 min to set up
              </div>
            </div>
            <Link href="/signup" className="btn-primary" style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', fontSize: 15, padding: '14px 32px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Start Cleaning Free →
            </Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: primary, padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: '#fff', marginBottom: 2 }}>Trade Intelligence</div>
          <div className="lbl" style={{ color: onPrimaryContainer }}>Enterprise Ledger</div>
        </div>
        <div style={{ fontSize: 11, color: onPrimaryContainer, fontFamily: 'Inter,sans-serif' }}>
          India import export data cleaning · AI-powered · DGFT · HS code classification · Price per MT
        </div>
      </footer>
    </div>
  )
}
