import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const css = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#f7f9fb;color:#191c1e;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
a{color:inherit;text-decoration:none}
input{font-family:inherit}
.field{width:100%;padding:10px 14px;background:#ffffff;border:1px solid #e6e8ea;border-radius:4px;font-size:14px;color:#191c1e;outline:none;transition:border-color .15s;font-family:'Inter',sans-serif}
.field:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,0.08)}
.field::placeholder{color:#94969b}
.btn{width:100%;padding:12px;background:linear-gradient(135deg,#041627,#1a2b3c);color:#fff;border:none;border-radius:4px;font-family:'Inter',sans-serif;font-weight:600;font-size:14px;cursor:pointer;transition:opacity .15s;display:flex;align-items:center;justify-content:center;gap:8px}
.btn:hover{opacity:.88}
.btn:disabled{opacity:.6;cursor:not-allowed}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.fadeUp{animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both}
@keyframes spin{to{transform:rotate(360deg)}}
.spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
`

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) { setError(authErr.message); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div>
      <Head><title>Login — Trade Intelligence</title></Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Split layout */}
      <div style={{ display: 'flex', minHeight: '100vh' }}>

        {/* Left — brand panel */}
        <div style={{ width: 400, background: '#041627', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 40px', flexShrink: 0 }}>
          <div>
            <Link href="/" style={{ display: 'block', marginBottom: 48 }}>
              <div style={{ fontSize: 16, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: '#fff' }}>Trade Intelligence</div>
              <div style={{ fontSize: 8, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8192a7', marginTop: 2 }}>Enterprise Ledger</div>
            </Link>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', lineHeight: 1.2, marginBottom: 20 }}>
              India's EXIM<br />Intelligence Platform
            </div>
            <p style={{ fontSize: 13, color: '#8192a7', fontFamily: 'Inter,sans-serif', lineHeight: 1.8 }}>
              Clean shipper names, normalize importer records, and classify products from raw DGFT customs data — in minutes.
            </p>
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '🏢', text: 'Importer name normalization' },
              { icon: '🌏', text: 'Shipper entity resolution' },
              { icon: '🏷️', text: 'Product + Grade classification' },
              { icon: '💲', text: 'Price per MT auto-calculated' },
              { icon: '🔔', text: 'Competitor price alerts' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 12, color: '#8192a7', fontFamily: 'Inter,sans-serif' }}>{f.text}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginTop: 4 }}>
              <span style={{ fontSize: 11, fontFamily: 'Inter,sans-serif', fontWeight: 700, color: '#76d6d5', letterSpacing: '.06em', textTransform: 'uppercase' }}>✦ 100 rows free · No credit card</span>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#f7f9fb' }}>
          <div className="fadeUp" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ marginBottom: 36 }}>
              <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 26, color: '#041627', marginBottom: 6 }}>Welcome back</h1>
              <p style={{ fontSize: 13, color: '#44474c', fontFamily: 'Inter,sans-serif' }}>Sign in to your Trade Intelligence account</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#44474c', marginBottom: 7 }}>Email address</label>
                <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#44474c', marginBottom: 7 }}>Password</label>
                <input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {error && (
                <div style={{ background: '#ffdad6', border: '1px solid rgba(186,26,26,0.2)', borderRadius: 4, padding: '10px 14px', color: '#93000a', fontSize: 13, fontFamily: 'Inter,sans-serif', marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <button type="submit" className="btn" disabled={loading}>
                {loading ? <span className="spin" /> : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#44474c', fontFamily: 'Inter,sans-serif' }}>
              No account?{' '}
              <Link href="/signup" style={{ color: '#0ea5e9', fontWeight: 600 }}>Create one free →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
