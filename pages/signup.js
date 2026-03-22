import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
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

export default function Signup() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error: authErr } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    })
    if (authErr) { setError(authErr.message); setLoading(false) }
    else setDone(true)
  }

  if (done) return (
    <div>
      <Head><title>Check Email — Trade Intelligence</title></Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f7f9fb', padding: 24 }}>
        <div className="fadeUp" style={{ maxWidth: 440, width: '100%', background: '#fff', padding: '48px 40px', textAlign: 'center', borderTop: '3px solid #3a9f9e' }}>
          <div style={{ width: 56, height: 56, borderRadius: 8, background: '#002f2f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>📧</div>
          <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 22, color: '#041627', marginBottom: 10 }}>Check your inbox</h2>
          <p style={{ color: '#44474c', lineHeight: 1.75, fontSize: 14, fontFamily: 'Inter,sans-serif', marginBottom: 8 }}>
            We sent a confirmation link to
          </p>
          <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#041627', marginBottom: 20 }}>{email}</p>
          <p style={{ color: '#44474c', fontSize: 13, fontFamily: 'Inter,sans-serif', lineHeight: 1.7, marginBottom: 32 }}>
            Click the link to activate your account and unlock your{' '}
            <strong style={{ color: '#3a9f9e' }}>5,000 free rows</strong>.
          </p>
          <Link href="/login" style={{ display: 'block', padding: '11px 24px', background: 'transparent', border: '1px solid #e6e8ea', borderRadius: 4, fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: 13, color: '#041627', textAlign: 'center', transition: 'border-color .15s' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <Head><title>Sign Up — Trade Intelligence</title></Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div style={{ display: 'flex', minHeight: '100vh' }}>

        {/* Left — brand panel */}
        <div style={{ width: 400, background: '#041627', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 40px', flexShrink: 0 }}>
          <div>
            <Link href="/" style={{ display: 'block', marginBottom: 48 }}>
              <div style={{ fontSize: 16, fontFamily: 'Manrope,sans-serif', fontWeight: 800, color: '#fff' }}>Trade Intelligence</div>
              <div style={{ fontSize: 8, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8192a7', marginTop: 2 }}>Enterprise Ledger</div>
            </Link>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', lineHeight: 1.2, marginBottom: 20 }}>
              Start cleaning your<br />trade data today
            </div>
            <p style={{ fontSize: 13, color: '#8192a7', fontFamily: 'Inter,sans-serif', lineHeight: 1.8 }}>
              Upload any DGFT or customs Excel file. AI applies 8 rules and returns clean, normalized, analysis-ready data in minutes.
            </p>
          </div>

          {/* What you get */}
          <div>
            <div style={{ fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8192a7', marginBottom: 16 }}>What you get free</div>
            {[
              '100 rows cleaned instantly',
              'Product + Grade classification',
              'Importer & shipper normalization',
              'Outlier detection & flagging',
              'Price per MT calculation',
              'FY and Month mapping',
              'Insights dashboard',
              'Price alert watches',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#76d6d5', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#8192a7', fontFamily: 'Inter,sans-serif' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#f7f9fb' }}>
          <div className="fadeUp" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 26, color: '#041627', marginBottom: 6 }}>Create your account</h1>
              <p style={{ fontSize: 13, color: '#44474c', fontFamily: 'Inter,sans-serif' }}>
                Free forever up to 100 rows. No credit card required.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#44474c', marginBottom: 7 }}>Full name</label>
                <input className="field" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#44474c', marginBottom: 7 }}>Email address</label>
                <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 9, fontFamily: 'Inter,sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#44474c', marginBottom: 7 }}>Password</label>
                <input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required />
              </div>
              {error && (
                <div style={{ background: '#ffdad6', border: '1px solid rgba(186,26,26,0.2)', borderRadius: 4, padding: '10px 14px', color: '#93000a', fontSize: 13, fontFamily: 'Inter,sans-serif', marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <button type="submit" className="btn" disabled={loading}>
                {loading ? <span className="spin" /> : 'Create Free Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#44474c', fontFamily: 'Inter,sans-serif' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#0ea5e9', fontWeight: 600 }}>Sign in →</Link>
            </div>

            <div style={{ marginTop: 32, padding: '14px 16px', background: '#fff', borderLeft: '3px solid #3a9f9e', fontSize: 12, color: '#44474c', fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>
              By signing up you agree to our terms. Your data is processed only to clean your uploaded files and is never shared.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
