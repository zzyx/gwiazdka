# Gwiazdki

A family motivation PWA. See `CLAUDE.md` and `CONTEXT.md`.

## Handbook

- [Architecture](docs/architecture.md): what the app is made of, how routes, `lib/` and Supabase connect, dependencies, services and the deploy flow.
- [Running it on a Mac](docs/local-setup-macos.md): installing the tools, starting the app with a local database, signing in as the seed family, running the checks, trying it on an iPhone, and troubleshooting.
- [Database](docs/database.md): connecting to each database, what every table means, who sees what (RLS), ready-to-paste queries, and how migrations and the seed fit together.

## Develop

Step by step, from a fresh Mac: [docs/local-setup-macos.md](docs/local-setup-macos.md). In short, with Node 22 and Docker running:

```sh
npm install
npx supabase start   # local database with the seed family
npx supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --override-name auth.secret_key=SUPABASE_SECRET_KEY \
  | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' > .env.local
npm run dev          # http://localhost:3000, parent@example.com / password
```

Migrations live in `supabase/migrations/`.

Checks (the same ones CI runs): `npm run lint`, `npm run typecheck`, `npm test`, `npx supabase test db`.

## Deploy

Vercel builds a preview for every pull request and deploys production from `main`. The Supabase env vars are set in the Vercel project, never in the repo.
