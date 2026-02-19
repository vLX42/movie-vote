# Movie Night Voting

A self-hosted movie voting app for groups. Drop invite links, nominate films, and vote — the winner is declared automatically when the host closes the session.

Built for Jellyfin/Jellyseerr setups but works standalone too.

---

## Features

- **Invite-only access** — participants join via single-use links; no accounts or sign-ups
- **Hierarchical invites** — voters can invite others (configurable depth limit and slot count)
- **Invite management** — label your invite links, see who joined through them
- **Movie nominations** — search Jellyfin library or TMDB; movies are marked as "in library", "requested", or "nominated only"
- **Jellyseerr integration** — requesting a movie via TMDB creates a Jellyseerr request automatically
- **Vote tokens** — each voter gets a fixed number of votes (configurable per session); max one vote per movie
- **Live standings** — vote counts update in real time (15-second polling)
- **Admin panel** — create sessions, manage voters, adjust invite slots, revoke codes, close voting, delete sessions
- **Winner banner** — declared automatically by vote count when the session closes
- **Browser fingerprinting** — detects repeated join attempts without cookies

---

## Screenshots

The UI uses a dark, monospace-heavy film-reel aesthetic throughout.

| View | Description |
|------|-------------|
| Join page | Animated ticket reveal on first visit |
| Voting room | Movie grid with poster, vote buttons, status badges |
| Standings | Ranked bar chart of vote counts |
| Invites | Manage your invite links, name them, see who joined |
| Admin | Session list, voter tree, invite code management |

---

## Stack

- [TanStack Start](https://tanstack.com/start) — full-stack React framework (SSR + server functions)
- [TanStack Router](https://tanstack.com/router) — file-based routing
- [Drizzle ORM](https://orm.drizzle.team) — type-safe SQLite queries
- [SQLite](https://www.sqlite.org) — embedded database via `node:sqlite`
- [Vite](https://vite.dev) — build tooling
- [Framer Motion](https://www.framer.com/motion) — animations

---

## Quick Start with Docker Compose

### 1. Create the external Docker network (once)

```bash
docker network create movienightnet
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env`:

```env
ADMIN_SECRET=your_long_random_secret    # openssl rand -hex 32
DATABASE_URL=file:/app/db-data/movienightapp.db

# Optional — omit if not using Jellyfin/Jellyseerr
JELLYFIN_URL=http://jellyfin:8096
JELLYFIN_API_KEY=your_jellyfin_api_key
JELLYSEERR_URL=http://jellyseerr:5055
JELLYSEERR_API_KEY=your_jellyseerr_api_key
```

### 3. Start the app

```bash
docker compose up -d
```

The app is available at `http://your-host:8090`.

The database is persisted to `./db/movienightapp.db` on the host.

---

## First Use

1. Open `http://your-host:8090/admin`
2. Enter your `ADMIN_SECRET`
3. Click **New Session** and fill in the form
4. Copy the generated root invite link(s) and share them

---

## Admin Panel

`/admin` — requires `ADMIN_SECRET` (stored in browser localStorage).

### Creating a session

| Field | Default | Notes |
|-------|---------|-------|
| Name | — | Display name for the session |
| Slug | — | URL-safe identifier, e.g. `friday-night` → `/vote/friday-night` |
| Votes per voter | 5 | Each voter gets this many vote tokens |
| Root invite codes | 1 | How many top-level invite links to generate |
| Guest invite slots | 1 | How many invite links each voter may create |
| Max invite depth | unlimited | How many levels of re-inviting are allowed |
| Allow Jellyseerr requests | on | Whether voters can request movies from TMDB |
| Expires at | — | Optional session expiry date |

### Session management

From the session detail page you can:
- **Generate more root invite codes**
- **Adjust per-voter invite slots**
- **Revoke unused codes**
- **Remove voters**
- **View the invite tree** (who invited whom)
- **Close voting** — computes winner by vote count, shows winner banner
- **Delete session** — removes all voters, votes, movies, and codes permanently

---

## Voting Room

`/vote/{slug}` — accessible only to voters who have claimed an invite link.

- **Movies tab** — grid of nominated films with vote buttons
- **Standings tab** — ranked list with vote counts
- **Invites tab** (visible if you have invite slots) — manage your invite links:
  - Create new links (up to your slot limit)
  - Name each link so you know who you sent it to
  - Copy a link's URL to share
  - See everyone who joined through your links

---

## Joining

`/join/{code}` — invite link landing page.

On first visit the voter chooses a display name, sees a confirmation ticket, and is redirected to the voting room. The code is single-use; subsequent visits with the same browser are detected and redirected without re-registering.

---

## Jellyfin / Jellyseerr Integration

Both integrations are optional. If neither is configured the search bar is hidden and voters cannot nominate movies (the admin would need to add movies another way, or the feature is simply unused).

| Integration | What it enables |
|-------------|----------------|
| Jellyfin | Search your media library; posters served from Jellyfin |
| Jellyseerr | Search TMDB; requesting a movie creates a Jellyseerr request |

Movies found in both appear with their correct status (`in library` / `requested` / `nominated only`).

---

## Development

```bash
# Install dependencies
pnpm install

# Copy env
cp .env.example .env   # fill in values

# Start dev server (http://localhost:3000)
pnpm dev

# After changing src/db/schema.ts:
pnpm db:generate       # generates SQL migration
pnpm db:migrate        # applies it

# Production build
pnpm build
pnpm start
```

### Running without Docker

Set `DATABASE_URL=file:./db-data/movienightapp.db` (or any path), then:

```bash
pnpm db:migrate
pnpm start
```

---

## Port Reference

| Port | Service |
|------|---------|
| 8090 | Movie Night app (mapped from container 3000) |
| 8096 | Jellyfin (if on same network) |
| 5055 | Jellyseerr (if on same network) |

---

## Docker Network

The compose file uses an **external** network called `movienightnet`. This allows the container to reach Jellyfin and Jellyseerr by their Docker service names without exposing ports. Create it once:

```bash
docker network create movienightnet
```

If you don't use Jellyfin/Jellyseerr you can change the network to `driver: bridge` and remove the `external: true` line.

---

## Data Persistence

The SQLite database is mounted at `./db` on the host (maps to `/app/db-data` in the container). Back this directory up to preserve all session data.

```bash
# Simple backup
cp ./db/movienightapp.db ./db/movienightapp.db.bak
```

---

## Security Notes

- `ADMIN_SECRET` is the only authentication mechanism — use a long random string
- Voter cookies are HttpOnly and SameSite=Lax
- There is no rate limiting on invite claims or votes; deploy behind a reverse proxy if exposed to the internet
- Browser fingerprinting is used to detect re-use of invite codes, not for tracking
