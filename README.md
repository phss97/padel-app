# 🎾 Padel Match Manager

**A PWA for managing padel matches** — track players, organize groups, schedule courts, split costs with Pix, and get real-time notifications.

Built with **React 19 + Vite + TypeScript + Tailwind CSS v4** on the frontend and **Supabase (PostgreSQL + Auth + Realtime)** on the backend.

---

## ✨ Features

| Feature | Status |
|---------|--------|
| 🔐 Auth (Magic Link + Google OAuth) | ✅ |
| 👥 Groups with invites (7-day expiry) | ✅ |
| 🏟️ Venues (public/private courts) | ✅ |
| 📅 Match creation with auto-merge | ✅ |
| ⏱️ Match extension | ✅ |
| ✅ Check-in / Forfeit | ✅ |
| 📋 Waitlist with cascade promotion | ✅ |
| 💸 Pix payment tracking | ✅ |
| 🔔 Web Push notifications | ✅ |
| 🌐 i18n (Portuguese + English) | ✅ |
| 📱 PWA (installable, offline shell) | ✅ |

---

## 🏗️ Architecture

### Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Server State** | TanStack Query |
| **Client State** | Zustand |
| **I18n** | i18next + react-i18next (pt default, en toggle) |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Hosting** | Render (static site) |
| **Notifications** | Web Push (VAPID) via Supabase Edge Functions |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/phss97/padel-app.git
cd padel-app
npm install
```

### 2. Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

### 3. Run Dev Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

---

## 🗄️ Database Setup

Run the SQL migrations in this order on your Supabase SQL Editor:

1. `supabase/migrations/001_init_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_match_merge_logic.sql`

Optional seed data: `supabase/seed.sql`

---

## 🔔 Push Notifications Setup

### Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### Deploy Edge Function

```bash
supabase functions deploy send-push
```

### Set Secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=xxx
supabase secrets set VAPID_PRIVATE_KEY=yyy
supabase secrets set VAPID_SUBJECT=mailto:your-email@gmail.com
```

---

## 🌍 i18n

- **Default**: Portuguese (pt-BR), auto-detected from `navigator.language`
- **Toggle**: Available in Profile settings
- **Fallback**: pt-BR

---

## 📱 PWA

The app is a Progressive Web App:
- Installable on mobile home screen
- Service worker handles push notifications
- Offline shell support

---

## 🛡️ Security

- Row Level Security (RLS) on all database tables
- `.env` and build artifacts excluded from Git
- Supabase `.temp/` files excluded from Git

---

## 📁 Folder Structure

```
src/
  components/    # Reusable UI (BottomNav, AuthProvider, ProtectedRoute)
  pages/         # Route-level pages (Login, Dashboard, Groups, Matches, Profile)
  hooks/         # Custom React hooks (useServiceWorker)
  lib/           # Client setup (supabase, i18n, match utils, push service)
  stores/        # Zustand stores (auth, app)
  types/         # TypeScript types
  locales/
    pt/          # pt-BR translations
    en/          # English translations

supabase/
  migrations/    # SQL schema + RLS policies + match logic
  functions/     # Edge Functions (push notifications)
  seed.sql       # Sample data
```

---

## 📝 Business Rules

1. **Auto-merge matches:** Adjacent matches at same venue are merged; `max_players` recalculated based on total duration.
2. **Explicit extend:** Users can extend a match from the match detail page.
3. **Creator auto-check-in:** When creating/extending, user is offered to join.
4. **Waitlist cascade:** Unlimited waitlist; continuous promotion when slots free.
5. **Ownership transfer:** If owner forfeits, earliest joined player gets promoted; if none remain, match is orphaned.
6. **Invite expiry:** 7 days.
7. **Soft delete:** Groups use `is_active`; history preserved.
8. **Language:** Auto-detect `navigator.language`, fallback pt-BR.

---

## 🚀 Deploy

### Supabase
- Create project → run migrations → configure Auth providers → set Edge Function secrets

### Render
- Connect GitHub repo `phss97/padel-app`
- Build command: `npm run build`
- Publish directory: `dist`
- Add environment variables

---

## 📄 License

MIT
