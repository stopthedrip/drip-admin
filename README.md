# drip Admin Dashboard

Web-based admin panel for the **drip** subscription management app. Built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- **Dashboard** — live metrics: total users, DAU/WAU, active subscriptions, Pro overrides, recent signups, top tracked services
- **User Management** — searchable user list with pagination, individual user profiles showing all subscriptions
- **Pro Access Control** — grant or revoke Pro entitlements to any user for 7 days, 30 days, 90 days, 1 year, or permanently, with reason tracking
- **Analytics** — signup trends (area chart), top events (bar chart), subscriptions by category (progress bars), with 7d/30d/90d period selector
- **Audit Log** — every admin action logged with timestamps, admin identity, target user, and details; filterable by action type
- **Auth Guard** — only users with `is_admin = true` in the `users` table can access the dashboard

## Setup

### 1. Supabase

Run the SQL migration in your Supabase project's SQL editor:

```
supabase/migrations/001_admin_schema.sql
```

This creates the `users`, `entitlement_overrides`, `subscriptions`, `analytics_events`, and `admin_audit_log` tables, along with RLS policies and the `dashboard_stats` view.

Then mark yourself as admin:

```sql
UPDATE public.users SET is_admin = true WHERE email = 'your-email@example.com';
```

### 2. Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

## Android App Integration

The Android app's `EntitlementRepositoryImpl` checks Supabase's `entitlement_overrides` table alongside RevenueCat. When an admin grants Pro access via this dashboard, the app picks it up on the next `refresh()` call — no app update required.

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS with drip brand colors (amber, cream, charcoal)
- Supabase (Auth + Postgrest + RLS)
- Recharts for analytics charts
- TypeScript throughout
