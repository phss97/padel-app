# Padel Match Manager

**A PWA for managing padel matches** — track players, organize groups, schedule courts, split costs with Pix, and get real-time notifications.

Built with **React 19 + Vite + TypeScript + Tailwind CSS v4** on the frontend and **Supabase (PostgreSQL + Auth + Realtime)** on the backend.

---

## Features

| Feature | Status |
|---------|--------|
| Auth (Magic Link + Password + Google OAuth) | ✅ |
| Groups with permanent and temporary invites | ✅ |
| Group settings (name, description, default venue, max players) | ✅ |
| Member management (promote/demote/remove) | ✅ |
| Venues (public/private courts) | ✅ |
| Match creation with auto-merge | ✅ |
| Match editing (time, duration, max players) | ✅ |
| Match extension (before/after + duration) | ✅ |
| Check-in / Forfeit / Kick players | ✅ |
| Waitlist with cascade promotion | ✅ |
| Ownership transfer (forfeit or edit) | ✅ |
| Pix payment tracking | ✅ |
| Upcoming match filters (all/available/full/not-joined) | ✅ |
| Web Push notifications | ✅ |
| i18n (Portuguese + English) | ✅ |
| PWA (installable, offline shell) | ✅ |

---

## Architecture

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

## Quick Start

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

## Database Setup

Run the SQL migrations in this order on your Supabase SQL Editor:

1. `supabase/migrations/001_init_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_match_merge_logic.sql`
4. `supabase/migrations/004_fix_rls_recursion.sql`
5. `supabase/migrations/005_fix_group_creator_select.sql`
6. `supabase/migrations/006_fix_group_members_insert.sql`
7. `supabase/migrations/007_fix_check_in_rejoin.sql`
8. `supabase/migrations/008_fix_invite_rls.sql`

---

## Push Notifications Setup

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

## i18n

- **Default**: Portuguese (pt-BR), auto-detected from `navigator.language`
- **Toggle**: Available in Profile settings
- **Fallback**: pt-BR

---

## PWA

The app is a Progressive Web App:
- Installable on mobile home screen
- Service worker handles push notifications
- Offline shell support

---

## Security

- Row Level Security (RLS) on all database tables
- `.env` and build artifacts excluded from Git
- Supabase `.temp/` files excluded from Git

---

## Folder Structure

```
src/
  components/    # Reusable UI (BottomNav, AuthProvider, ProtectedRoute)
  pages/         # Route-level pages (Login, Dashboard, Groups, GroupDetail,
                 #   GroupSettings, JoinGroup, CreateMatch, CreateVenue,
                 #   MatchDetail, Matches, Profile)
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

public/
  service-worker.js  # PWA service worker for push notifications
```

---

## Business Rules

1. **Auto-merge matches:** Adjacent matches at same venue are merged; `max_players` recalculated based on total duration.
2. **Explicit extend:** Owner can extend match duration with before/after direction.
3. **Match editing:** Owner can edit start/end time and max players. If max players reduced below confirmed count, kick modal prompts which players to remove.
4. **Ownership transfer:** Owner can transfer match ownership from the edit modal. If owner forfeits with no other players, match auto-deletes.
5. **Creator auto-check-in:** When creating/extending, user is offered to join.
6. **Waitlist cascade:** Unlimited waitlist; continuous promotion when slots free.
7. **Permanent invites:** Every group has a never-expiring permanent invite link. Temporary invites expire after 7 days.
8. **Soft delete:** Groups use `is_active`; history preserved.
9. **Language:** Auto-detect `navigator.language`, fallback pt-BR.

---

## Deploy

### Supabase
- Create project → run migrations → configure Auth providers → set Edge Function secrets

### Render
- Connect GitHub repo `phss97/padel-app`
- Build command: `npm run build`
- Publish directory: `dist`
- Add environment variables

---

## License

MIT
