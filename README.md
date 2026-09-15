# LinkCloud

Visual personal URL memory. Save frequently used links on a calm, searchable sky canvas.

> Temporary product name — rename in `src/config/app.ts`.

## Prerequisites

- Node.js 20+
- npm 10+
- A [Supabase](https://supabase.com) project
- A Google Cloud OAuth client (for Google sign-in)

## Installation

```bash
npm install
cp .env.example .env.local
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key (browser-safe) |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for OAuth (`http://localhost:3000` locally) |

Never put the Supabase **service role** key in this app.

## Supabase setup

1. Create a project in the Supabase dashboard.
2. Copy Project URL + publishable/anon key into `.env.local`.
3. Run migrations in order (SQL Editor or CLI):
   - `supabase/migrations/20260328120000_init.sql`
   - `supabase/migrations/20260328140000_performance_indexes.sql`
4. Confirm RLS is enabled on `profiles`, `links`, `tags`, `link_tags`.

## Google OAuth

1. Google Cloud Console → Credentials → OAuth client ID (Web).
2. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://YOUR_DOMAIN`
3. Authorized redirect URI (Supabase, not Next.js):
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Supabase → Authentication → Providers → Google → paste Client ID/Secret.
5. Supabase → Authentication → URL Configuration:
   - Site URL: production or `http://localhost:3000`
   - Redirect allow-list:
     - `http://localhost:3000/auth/callback`
     - `https://YOUR_DOMAIN/auth/callback`

## Local development

```bash
npm run dev
```

Optional (signed-in, development only): Settings → **Seed demo links**.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Deploy to Vercel

1. Import the Git repo in Vercel.
2. Set the three environment variables above (`NEXT_PUBLIC_SITE_URL` = your production URL).
3. Deploy.
4. Update Google origins + Supabase redirect URLs for the production domain.
5. Re-run both SQL migrations on the production Supabase project if not already applied.

### CSP notes

`next.config.ts` sets security headers including CSP. Exceptions:

- `'unsafe-inline'` / `'unsafe-eval'` on `script-src` for Next.js App Router
- `'unsafe-inline'` on `style-src` for Tailwind/runtime styles
- Supabase HTTPS/WSS hosts for auth + data

Tighten further once you have a fixed Supabase project ref and can drop wildcards.

## Architecture (MVP)

- **Next.js 16 App Router** + `src/proxy.ts` session refresh
- **Supabase Auth** (Google) + Postgres RLS
- **React Flow** camera only; custom `UrlBubbleNode`
- **Fuse.js** local search via `SearchProvider` interface (`src/lib/search`)
- **Safe metadata fetch** (`src/lib/metadata`) with SSRF checks + rate limit

## Known MVP limitations

- Personal accounts only — no teams, sharing, billing, SSO
- No embeddings / semantic search yet (interface is ready to swap)
- Metadata fetch is best-effort and rate-limited; private hosts are blocked
- In-memory rate limit is per serverless isolate (not a global redis limiter)
- No aggressive offline caching (PWA installable; online required for sync)

## License

Private / unpublished unless you add a license.
