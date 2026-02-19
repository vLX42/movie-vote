# CLAUDE.md — Movie Night Voting App

## Stack

- **Framework**: TanStack React Start (SSR) + TanStack Router (file-based)
- **Server runtime**: Nitro (via `@tanstack/react-start`)
- **Database**: SQLite via `node:sqlite` + Drizzle ORM (`drizzle-orm/sqlite-proxy`)
- **Build**: Vite 7
- **Styling**: Single flat CSS file (`src/styles/global.css`), BEM-ish class names
- **Animation**: Framer Motion

## Project Layout

```
src/
  components/     # Shared React components (MovieCard, SearchBar, InviteLink, …)
  db/
    schema.ts     # Drizzle table definitions (single source of truth for DB shape)
    index.ts      # DB instance — sqlite-proxy adapter with setReturnArrays(true)
    migrate.ts    # Migration runner (run with `pnpm db:migrate`)
  lib/
    inviteCodes.ts  # generateInviteCode() — crypto-random, visually unambiguous charset
  routes/         # TanStack Router file-based routes
    __root.tsx    # Root layout, global styles
    index.tsx     # Redirects / → /admin
    admin/        # Admin dashboard and session management
    join/$code.tsx  # Invite claim + onboarding
    vote/$slug/   # Voting room, standings, invite management
    api/          # API routes (health, image proxies)
  server/         # createServerFn() RPC handlers (run on server only)
    admin.ts      # All admin-only operations (requireAdmin guard)
    invites.ts    # claimInvite() — main join flow
    movies.ts     # nominateMovie(), requestMovie()
    search.ts     # searchJellyfin(), searchTmdb()
    sessions.ts   # getSession(), updateDisplayName()
    voter-invites.ts  # createVoterInvite(), setInviteCodeLabel()
    votes.ts      # castVote(), retractVote()
  styles/
    global.css    # All styles; organised with section comments
  utils/
    clipboard.ts  # copyToClipboard() with HTTP fallback (execCommand)
    fingerprint.ts  # getBrowserFingerprint() — canvas + hardware SHA-256 hash
drizzle/          # SQL migration files (0000_…, 0001_…, 0002_…)
```

## Critical SQLite-Proxy Quirk

**`count()` from drizzle-orm DOES NOT WORK correctly through the sqlite-proxy adapter.**

With `setReturnArrays(true)`, `count()` always returns `1` regardless of the actual count. This causes bugs like "already voted" on first vote, and post-vote counts returning 0.

**Rule**: Never use `count()` anywhere in this codebase. Instead:
- Use `.all()` and check `.length` for counting rows
- Use `.get()` and check truthiness for existence checks
- Compute aggregates in JavaScript after fetching all rows

Example pattern used throughout:
```typescript
// BAD — broken with sqlite-proxy
const [{ cnt }] = await db.select({ cnt: count() }).from(votes).where(…);

// GOOD
const rows = await db.select({ id: votes.id }).from(votes).where(…);
const cnt = rows.length;

// GOOD — existence check
const existing = await db.select({ id: votes.id }).from(votes).where(…).limit(1).get();
if (existing) { … }
```

## Database Schema Summary

| Table | Key columns |
|-------|-------------|
| `sessions` | id, slug, name, status (open/closed), votes_per_voter, max_invite_depth, guest_invite_slots, winner_movie_id |
| `movies` | id, session_id, title, year, poster_url, status (in_library/requested/nominated_only), vote_count (computed in JS) |
| `voters` | id, session_id, display_name, fingerprint, invite_code, invite_depth, invite_slots_remaining, invited_by |
| `votes` | id, session_id, voter_id, movie_id |
| `invite_codes` | code (PK), session_id, created_by_voter_id, used_by_voter_id, status (unused/used/revoked), label |

**No FK CASCADE** — when deleting sessions manually cascade in order: `votes → invite_codes → voters → movies → sessions`.

## Invite System

- Root codes: created by admin, `created_by_voter_id = null`
- Guest codes: created by voters who have `invite_slots_remaining > 0`
- `invite_slots_remaining` = the MAX codes a voter may create (it is NOT decremented on creation; enforced by checking `existingCodes.length >= voter.inviteSlotsRemaining`)
- `voters.invited_by` = the `created_by_voter_id` of the code they used; enables querying a voter's invitees
- Depth controlled by `sessions.max_invite_depth` (null = unlimited)
- Voter cookie: `movienightapp_voter` (HttpOnly, SameSite=Lax, 365d)

## Admin Authentication

Single shared `ADMIN_SECRET` env var. The `requireAdmin(secret)` function is called at the top of every admin server function. The secret is stored in browser `localStorage` on the admin UI and sent with every admin RPC call.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | SQLite path e.g. `file:/app/db-data/movienightapp.db` |
| `ADMIN_SECRET` | Yes | Admin password (use `openssl rand -hex 32`) |
| `JELLYFIN_URL` | No | e.g. `http://jellyfin:8096` |
| `JELLYFIN_API_KEY` | No | Jellyfin API key |
| `JELLYSEERR_URL` | No | e.g. `http://jellyseerr:5055` |
| `JELLYSEERR_API_KEY` | No | Jellyseerr API key |

## Scripts

```bash
pnpm dev          # Dev server (port 3000, hot reload)
pnpm build        # Production build → .output/
pnpm start        # Run production build
pnpm db:generate  # Generate migration from schema changes
pnpm db:migrate   # Apply pending migrations
```

## Adding New Features — Checklist

1. **Schema change** → edit `src/db/schema.ts`, run `pnpm db:generate`, commit the SQL file
2. **Server logic** → add/edit in `src/server/`, use `createServerFn({ method: "POST" })`, never use `count()`
3. **New route** → create file in `src/routes/`, TanStack Router picks it up automatically
4. **Styles** → add to `src/styles/global.css` in the relevant section
5. **Docker** → DB migrations run automatically on container start (`pnpm db:migrate && pnpm start`)

## Image Proxying

Jellyfin and TMDB poster images are proxied through the app:
- `/api/images/jellyfin/$id` → Jellyfin API item image
- `/api/images/tmdb/$path` → `image.tmdb.org/t/p/w400/…`

Both routes add `Cache-Control: public, max-age=86400`.

## Clipboard API

`copyToClipboard()` in `src/utils/clipboard.ts` tries the modern Clipboard API first, then falls back to `document.execCommand('copy')`. The fallback exists for plain HTTP deployments (e.g. Unraid LAN without TLS) where the Clipboard API is unavailable.
