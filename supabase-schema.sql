-- ─────────────────────────────────────────────────────────────────────────────
-- Run this ENTIRE file in Supabase SQL Editor → New Query → Run
-- This is ADDITIVE — safe to run on an existing database
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. User quota
create table if not exists public.user_quota (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  rows_used integer not null default 0,
  rows_limit integer not null default 5000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Usage log
create table if not exists public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  rows_cleaned integer not null,
  filename text,
  created_at timestamptz default now()
);

-- 3. Alert watches — user-defined price/importer/product monitors
create table if not exists public.alert_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  watch_type text not null default 'import',
  product text default '',
  grade text default '',
  importer text default '',
  supplier text default '',
  origin_country text default '',
  indian_port text default '',
  price_below_usd numeric default null,
  price_above_usd numeric default null,
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  trigger_count integer not null default 0,
  created_at timestamptz default now()
);

-- 4. Alert events — fired when a watch matches a cleaned row
create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid references public.alert_watches(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  matched_product text,
  matched_grade text,
  matched_importer text,
  matched_supplier text,
  matched_price_usd numeric,
  matched_volume_mt numeric,
  matched_port text,
  matched_origin text,
  matched_month text,
  matched_fy text,
  source_filename text,
  is_read boolean not null default false,
  emailed boolean not null default false,
  created_at timestamptz default now()
);

-- 5. Trade news cache — public, SEO-indexed
create table if not exists public.trade_news (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  summary text not null,
  category text not null,
  tags text[] default '{}',
  source_url text default '',
  source_name text default '',
  slug text unique,
  meta_description text,
  published_at timestamptz default now(),
  is_published boolean not null default true,
  created_at timestamptz default now()
);

-- 6. RLS
alter table public.user_quota      enable row level security;
alter table public.usage_log       enable row level security;
alter table public.alert_watches   enable row level security;
alter table public.alert_events    enable row level security;
alter table public.trade_news      enable row level security;

drop policy if exists "Users see own quota"         on public.user_quota;
drop policy if exists "Users see own usage"         on public.usage_log;
drop policy if exists "Users manage own watches"    on public.alert_watches;
drop policy if exists "Users see own alerts"        on public.alert_events;
drop policy if exists "News is public"              on public.trade_news;

create policy "Users see own quota"         on public.user_quota    for select using (auth.uid() = user_id);
create policy "Users see own usage"         on public.usage_log     for select using (auth.uid() = user_id);
create policy "Users manage own watches"    on public.alert_watches for all    using (auth.uid() = user_id);
create policy "Users see own alerts"        on public.alert_events  for all    using (auth.uid() = user_id);
create policy "News is public"              on public.trade_news    for select using (true);

-- 7. Auto-create quota on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_quota (user_id, rows_used, rows_limit)
  values (new.id, 0, 5000);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Indexes
create index if not exists idx_alert_watches_user   on public.alert_watches(user_id) where is_active = true;
create index if not exists idx_alert_events_user    on public.alert_events(user_id, is_read);
create index if not exists idx_trade_news_published on public.trade_news(published_at desc) where is_published = true;
create index if not exists idx_trade_news_slug      on public.trade_news(slug);
