# Trade Intelligence — Complete Setup Guide
### From zero to live production website. Every step written for beginners.

---

## What this is

A full SaaS website where users sign up, upload raw India import/export Excel files, and get back AI-cleaned data with insights, alerts, and trade news — all free up to a per-user quota you control.

**Everything used is free:**
| Service | What it does | Cost |
|---------|-------------|------|
| Next.js | The website framework | Free |
| Supabase | User login + database | Free (up to 500MB) |
| Groq | AI that cleans data (LLaMA 3.3 70B) | Free |
| Vercel | Hosts the website | Free |
| cron-job.org | Runs daily news refresh | Free |

---

## What's in the box

```
trade-intelligence/
├── pages/
│   ├── index.js              ← Landing page with trade news + SEO
│   ├── login.js              ← Login page
│   ├── signup.js             ← Signup (users get free quota instantly)
│   ├── dashboard.js          ← Full app: Upload, Insights, Alerts, History
│   └── api/
│       ├── clean.js          ← Runs AI cleaning, checks quota, fires alerts
│       ├── quota.js          ← Returns user quota + cleaning history
│       ├── alerts.js         ← CRUD for alert watches + events
│       ├── news.js           ← Public trade news endpoint (SEO)
│       └── news-refresh.js   ← Generates fresh news via Groq (run daily)
├── lib/
│   ├── supabase.js           ← Database connection
│   ├── cleaner.js            ← All 8 cleaning rules + Groq AI
│   └── alerts.js             ← Alert matching engine
├── styles/
│   └── globals.css           ← All styles
├── supabase-schema.sql       ← Run once in Supabase SQL Editor
├── vercel.json               ← API timeout settings
└── .env.local.example        ← Copy this to .env.local and fill in keys
```

---

## STEP 1 — Install Node.js

Go to **https://nodejs.org** → download the **LTS** version → install it.

Verify it worked by opening Terminal (Mac) or Command Prompt (Windows) and typing:
```
node --version
npm --version
```
Both should show version numbers. If not, restart your computer and try again.

---

## STEP 2 — Set up the project

1. Unzip the downloaded file
2. Open Terminal / Command Prompt inside the `trade-intel-free` folder
   - **Windows tip:** In File Explorer, navigate into the folder, click the address bar, type `cmd`, press Enter
3. Run:
```bash
npm install
```
Wait 1–2 minutes. You'll see a `node_modules` folder appear.

---

## STEP 3 — Create your three free accounts (~15 minutes)

### A. Supabase — database + user auth
1. Go to **https://supabase.com** → Sign Up free
2. Click **New Project** → name: `trade-intelligence` → set a database password → pick a region close to India (Singapore or Mumbai) → click **Create**
3. Wait ~2 minutes for the project to spin up
4. Click **SQL Editor** in the left sidebar → **New Query**
5. Open `supabase-schema.sql` from this folder → copy EVERYTHING → paste into the editor → click **Run**
6. You should see "Success" — this creates all your tables, security rules, and auto-quota trigger

**Copy these 3 keys** (Settings gear icon → API):
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY` ← keep this private

### B. Groq — free AI
1. Go to **https://console.groq.com** → Sign Up free
2. Click **API Keys** → **Create API Key** → copy it
3. This is your `GROQ_API_KEY` (starts with `gsk_`)

---

## STEP 4 — Set up your environment file

1. Find the file `.env.local.example` in the project folder
2. Make a COPY of it — name the copy `.env.local` (no `.example` at the end)
3. Open `.env.local` in Notepad/VS Code and fill in every value:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
GROQ_API_KEY=gsk_...
NEWS_REFRESH_SECRET=make-up-any-random-string-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**NEWS_REFRESH_SECRET** — just type any random phrase, e.g. `my-trade-news-secret-2025`. You'll use this later to trigger news generation.

---

## STEP 5 — Run it locally and test

In Terminal inside the project folder:
```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

**Test the full flow:**
1. Click **Sign Up Free** → enter your email + password
2. Supabase may or may not require email confirmation depending on your settings
   - If you don't get an email: Supabase dashboard → Authentication → Providers → Email → turn OFF "Confirm email"
3. Log in → you should see the dashboard with your quota bar
4. Go to **Supabase → Table Editor → user_quota** and confirm your row exists with `rows_limit: 5000`
5. Upload a small import Excel file → click Clean → wait 30–120 seconds → see results

**Test alerts:**
1. Click **🔔 Alerts** tab in the dashboard
2. Create a watch: name it "Test", product "anything", no price threshold
3. Upload and clean any file — any row will match since all criteria are blank
4. Refresh the page — you should see an alert event appear

**Generate news (optional for local testing):**
```bash
curl -X POST http://localhost:3000/api/news-refresh \
  -H "x-refresh-secret: your-secret-from-env" \
  -H "Content-Type: application/json"
```
Or on Windows using PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/news-refresh" -Method POST -Headers @{"x-refresh-secret"="your-secret-from-env"; "Content-Type"="application/json"}
```
After running, refresh the landing page — you should see trade news cards appear.

---

## STEP 6 — Deploy to Vercel

### Push code to GitHub
1. Go to **https://github.com** → sign up or log in → click **+** → **New repository**
2. Name it `trade-intelligence` → click **Create repository**
3. Run in Terminal:
```bash
git init
git add .
git commit -m "first deploy"
git remote add origin https://github.com/YOUR-USERNAME/trade-intelligence.git
git push -u origin main
```

### Deploy on Vercel
1. Go to **https://vercel.com** → sign up with GitHub
2. Click **Add New → Project** → find `trade-intelligence` → click **Import**
3. Click **Environment Variables** and add ALL of these (one by one):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `GROQ_API_KEY` | Your Groq API key |
| `NEWS_REFRESH_SECRET` | Same random string you put in .env.local |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now |

4. Click **Deploy** → wait ~60 seconds → you get a live URL like `https://trade-intelligence-xyz.vercel.app`

### Post-deploy: update 3 things

**1. Update APP_URL on Vercel:**
- Vercel dashboard → your project → Settings → Environment Variables
- Edit `NEXT_PUBLIC_APP_URL` → set to your actual Vercel URL
- Deployments → click **Redeploy**

**2. Update Supabase auth settings:**
- Supabase dashboard → Authentication → URL Configuration
- **Site URL:** `https://trade-intelligence-xyz.vercel.app`
- **Redirect URLs:** add `https://trade-intelligence-xyz.vercel.app/**`
- Save

**3. Set up daily news refresh (important for SEO):**
- Go to **https://cron-job.org** → sign up free
- Click **Create cronjob**
- URL: `https://trade-intelligence-xyz.vercel.app/api/news-refresh`
- Method: **POST**
- Add custom header: `x-refresh-secret` = your NEWS_REFRESH_SECRET value
- Schedule: **Every day at 06:00**
- Save and enable

This keeps your landing page fresh with new trade news every day, which is what makes Google rank you higher over time.

---

## STEP 7 — Seed your first news (do this once after deploying)

Call the news endpoint manually once so your landing page has content on day one:

Go to this URL in your browser (replace values):
```
https://trade-intelligence-xyz.vercel.app/api/news-refresh
```
Wait — it won't work from a browser (needs POST). Use cron-job.org to trigger it manually:
- Go to your cronjob → click **Run now**
- Wait 10–20 seconds
- Visit your landing page — news cards should appear

---

## Changing the quota (rows per user)

**For new signups** — edit `supabase-schema.sql` line:
```sql
values (new.id, 0, 5000);  ← change 5000
```

**For ALL existing users right now** — run in Supabase SQL Editor:
```sql
UPDATE public.user_quota SET rows_limit = 10000;
```

**For one specific user:**
```sql
UPDATE public.user_quota SET rows_limit = 50000
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'someone@example.com');
```

---

## Quick reference

| Task | Command |
|------|---------|
| Run locally | `npm run dev` |
| Stop local server | Ctrl + C |
| Deploy an update | `git add . && git commit -m "update" && git push` |
| Check if Groq is working | Look in Vercel → your project → Logs |
| View database tables | Supabase → Table Editor |
| View user signups | Supabase → Authentication → Users |

---

## How each feature works

**Data cleaning** — user uploads Excel → `/api/clean` checks quota → runs `lib/cleaner.js` (Groq AI + smart column matching) → deducts quota → logs job → triggers alert checks → returns results

**Alert watches** — user creates a watch with any combination of: product, grade, importer, supplier, country, port, price threshold → every clean job runs `lib/alerts.js` which checks every cleaned row against every active watch → matching rows become alert events → user sees them in the 🔔 Alerts tab

**Trade news** — `/api/news-refresh` calls Groq to generate 10 realistic trade news items across 5 categories → stores in `trade_news` table → `/api/news` serves them publicly → landing page fetches them server-side (`getServerSideProps`) so Google indexes the content → daily cron keeps content fresh

**SEO strategy** — landing page renders news server-side (not client-side), contains trade-specific keywords in headlines and summaries, has a keyword tag cloud, and updates daily. Google sees a live, relevant, keyword-rich page and ranks it for long-tail searches like "carbon black import India price" and "DGFT notification customs data".

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm install` fails | Make sure you're inside the project folder. Run `dir` (Windows) or `ls` (Mac) — you should see `package.json` |
| Can't log in / email not arriving | Supabase → Auth → Providers → Email → turn off "Confirm email" |
| "0 rows remaining" on fresh signup | Run the SQL in `supabase-schema.sql` again — the trigger wasn't set up |
| Cleaning fails silently | Check Vercel → your project → Logs for the error. Usually a wrong GROQ_API_KEY |
| News not showing on landing page | Trigger a manual news refresh via cron-job.org → Run now |
| Alerts not firing | Create a watch with ALL fields empty (matches everything) → clean any file → check Alerts tab |
| Site URL shows localhost in emails | Update NEXT_PUBLIC_APP_URL in Vercel env variables → redeploy |
| `next` is not recognized | Run `npm install` first. If still failing: `npm install -g next` |
