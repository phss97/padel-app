# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint across the codebase |
| `./scripts/deploy-check.sh` | Pre-deployment validation (builds, checks gitignore) |
| `./scripts/deploy-render.sh` | Build + check for secrets in `dist/` |

There is **no test suite** in this project. Do not run `npm test`.

## Architecture

### Stack
- **Frontend:** React 19 + Vite + TypeScript (ESM, `type: "module"`)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin, not PostCSS)
- **Server State:** TanStack Query (React Query) with default options `retry: false`, `refetchOnWindowFocus: false`
- **Client State:** Zustand (`src/stores/authStore.ts`, `src/stores/appStore.ts`)
- **Router:** `react-router-dom` with `BrowserRouter`
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **i18n:** i18next + `react-i18next`, default `pt-BR`, toggle in Profile
- **PWA:** Manual service worker at `public/service-worker.js` handling Web Push notifications

### State Management Split
- **Zustand (`authStore`):** Auth session, user, sign-in/out methods. `initialize()` reads Supabase session on mount and sets up `onAuthStateChange` listener. Stores `auth_redirect` in `localStorage` for post-login redirect.
- **TanStack Query:** All server data (matches, groups, venues, players). Invalidated via `queryClient.invalidateQueries()` after mutations.

### Auth Flow
- Login page at `/`. Protected routes wrap components in `ProtectedRoute` (redirects to `/` if unauthenticated).
- `AuthProvider` initializes auth state on app mount. Both `AuthProvider` and `ProtectedRoute` show a spinner while `isInitialized` is false.
- Methods: Magic Link OTP (`signInWithOtp`) and Google OAuth (`signInWithOAuth`). Redirect target is `/dashboard`.

### Database Backend (Supabase)
- **Client:** `src/lib/supabase.ts` — single `createClient` with `autoRefreshToken`, `persistSession`, `detectSessionInUrl`.
- **RLS:** All tables have Row Level Security policies. See `supabase/migrations/002_rls_policies.sql` and `004_fix_rls_recursion.sql`.
- **SQL Functions (in `003_match_merge_logic.sql`):**
  - `try_merge_match(match_id)` — Auto-merges adjacent matches at same venue; recalculates `max_players`.
  - `extend_match(match_id, hours)` — Extends match end time; if overlapping match exists, calls `try_merge_match`.
  - `check_in_match(match_id, user_id)` — Adds player as `confirmed` or `waitlist` with position.
  - `forfeit_match(match_id, user_id)` — Cancels player; if owner forfeits, transfers ownership to earliest joined remaining player.
  - Trigger `trg_promote_waitlist` — Cascades waitlist promotion when slots free up.
  - Trigger `trg_auto_merge_match` — Fires `try_merge_match` after match insert.

### Notifications (Web Push)
- `public/service-worker.js` handles `push` events and `notificationclick`.
- `src/lib/push/pushService.ts` manages `PushManager` subscription using VAPID public key.
- Edge Function `supabase/functions/send-push/index.ts` sends push notifications via `web-push` library. Triggered by database webhooks on `match_players` changes.

### Key Business Rules
1. **Auto-merge matches:** Adjacent matches at same venue merge automatically on insert. `max_players` recalculated from group settings based on total duration (`<2h`, `<3h`, `3h+`).
2. **Explicit extend:** Owner can extend match duration. If extension overlaps another match, merge happens instead.
3. **Creator auto-check-in:** On match creation, user is offered to join via checkbox (`joinMatch` state in `CreateMatch.tsx`).
4. **Waitlist cascade:** Unlimited waitlist. When a confirmed player forfeits, earliest waitlisted player is promoted automatically.
5. **Ownership transfer:** If owner forfeits, earliest joined remaining player becomes owner. If no players remain, match is orphaned.
6. **Invite expiry:** Group invite codes expire after 7 days.
7. **Soft delete:** Groups use `is_active` flag.
8. **i18n:** Auto-detect from `navigator.language`, fallback `pt`. Toggle persists in `localStorage`.

## Environment Variables

Required in `.env` (never committed):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

## File Organization

| Directory | Contents |
|-----------|----------|
| `src/components/` | Reusable UI: `AuthProvider`, `ProtectedRoute`, `BottomNav` |
| `src/pages/` | Route-level components: `Login`, `Dashboard`, `Groups`, `GroupDetail`, `JoinGroup`, `CreateMatch`, `MatchDetail`, `Matches`, `Profile` |
| `src/hooks/` | `useServiceWorker` — registers `/service-worker.js` |
| `src/lib/` | `supabase.ts` (client), `matchUtils.ts` (duration → max_players calc), `push/pushService.ts` (Web Push subscription) |
| `src/stores/` | Zustand stores: `authStore.ts`, `appStore.ts` |
| `src/types/` | Shared TypeScript interfaces: `Profile`, `Group`, `Match`, `MatchPlayer`, `MatchPayment`, etc. |
| `src/locales/` | i18n JSON files: `pt/translation.json`, `en/translation.json` |
| `supabase/migrations/` | SQL schema, RLS policies, and match logic functions |
| `supabase/functions/send-push/` | Edge Function for Web Push |
| `public/service-worker.js` | PWA service worker for push notifications |
| `scripts/` | `deploy-check.sh`, `deploy-render.sh` |
| `render.yaml` | Render.com static site config (build + serve `dist/`) |

## Important Notes

- `calculateMaxPlayers(startTime, endTime, group)` in `src/lib/matchUtils.ts` is the source of truth for player capacity based on duration. It mirrors SQL logic in `003_match_merge_logic.sql`.
- The app uses **imported translation JSON files** (`src/locales/*/translation.json`) loaded at build time, not fetched dynamically.
- **No `src/tests/` or test runner** exists. Do not add testing infrastructure unless explicitly requested.
- Render deploys as a static site served with `npx serve -s dist`. SPA routing fallback must be handled by Render (already configured in `render.yaml`).
- Recent migrations (`004_fix_rls_recursion.sql`, `005_fix_group_creator_select.sql`) fixed RLS infinite recursion and creator visibility issues. When modifying RLS policies, test for recursion with nested group memberships.
