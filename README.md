# Gwiazdki

A family motivation PWA. See `CLAUDE.md` and `CONTEXT.md`.

## Develop

```sh
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev
```

Local Supabase (needs Docker): `npx supabase start`. Migrations live in `supabase/migrations/`.

Checks (the same ones CI runs): `npm run lint`, `npm run typecheck`, `npm test`.

## Deploy

Vercel builds a preview for every pull request and deploys production from `main`. The Supabase env vars are set in the Vercel project, never in the repo.
