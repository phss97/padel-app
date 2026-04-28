# Padel Match Manager — Project Notes

## Overview
PWA for managing padel matches: users check-in/out of matches, register new matches, handle groups, venues, payments, and notifications.

## Stack & Architecture
- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4
- **State:** TanStack Query (server) + Zustand (client)
- **i18n:** i18next + react-i18next (pt-BR default, en toggle)
- **Router:** react-router-dom
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Hosting:** Render (static site)
- **Notifications:** Web Push (VAPID) via Supabase Edge Functions
- **Payments:** Manual Pix tracking (display keys + paid status)
- **PWA:** Service Worker + manifest generated automatically by the framework

## Key Business Rules
1. **Auto-merge matches:** Adjacent matches at same venue are merged; max_players recalculated based on total duration.
2. **Explicit extend:** Users can extend a match from the match detail page.
3. **Creator auto-check-in:** When creating/extending, user is offered to join the match.
4. **Waitlist cascade:** Unlimited waitlist; continuous promotion when slots free.
5. **Ownership transfer:** If owner forfeits, earliest joined player gets promoted; if no players remain, match orphaned until someone joins.
6. **Invite expiry:** 7 days.
7. **Soft delete:** Groups use `is_active`; keeps history.
8. **Language:** Auto-detect `navigator.language`, fallback pt-BR, toggle in profile.

## Folder Structure
```
src/
  components/    — Reusable UI components
  pages/         — Route-level page components
  hooks/         — Custom React hooks
  lib/           — Client setup (supabase, i18n), match utils
  stores/        — Zustand stores
  types/         — TypeScript types
  locales/
    pt/          — pt-BR translations
    en/          — English translations
```

## Environment Variables
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_VAPID_PUBLIC_KEY
```

## Completed
- [x] Scaffold
- [x] Supabase setup
- [x] Auth
- [x] Groups
- [x] Venues
- [x] PWA
- [x] Matches (CRUD + merge + extend + check-in + forfeit)
- [x] Waitlist cascade
- [x] UI Polish
- [x] Payments (Pix + manual tracking)
- [x] Notifications (Web Push + Edge Functions)
- [x] i18n
- [x] README + Security

## Next up
1. Deploy on Render
2. Test Email Auth
| nav: | groups, matches...

## Database Schema (Planned)
See `supabase/migrations/001_init_schema.sql` and `002_rls_policies.sql`.

## Completed Phase 6 Features
### SQL Functions (`003_match_merge_logic.sql`)
- `try_merge_match(match_id)` — Auto-merges adjacent matches at same venue
- `extend_match(match_id, hours)` — Explicitly extends match duration
- `check_in_match(match_id, user_id)` — Check-in with waitlist support
- `forfeit_match(match_id, user_id)` — Forfeit with automatic ownership transfer
- Triggers: `trg_promote_waitlist` — Cascades waitlist promotion on slots opening

### Frontend Pages
- **CreateMatch.tsx** — Venue picker, date/time selector, duration options (1h/2h/3h+), court cost, auto check-in toggle
- **MatchDetail.tsx** — Player list, waitlist, check-in/forfeit buttons, extend button (owner), ownership transfer modal

### Database Triggers
- `trg_auto_merge_match` — Auto-merge on match insert
- `trg_promote_waitlist` — Cascade waitlist promotion after forfeit
