# Kilig (flowcast)

Emotion-first discovery for vertical drama — "Netflix without hosting."
Users pick a feeling, not a genre; the app surfaces titles that match,
then deep-links out to wherever each one actually lives (ReelShort,
DramaBox, YouTube, TikTok, etc).

**Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing the UI or
data model** — it documents the product philosophy (why match scores
are computed the way they are, why taxonomy is hidden behind a
disclosure, why there are so few Client Components) so those decisions
don't get accidentally undone in a future edit.

## Quick start

```bash
npm install                              # triggers `prisma generate` via postinstall
cp .env.example .env                     # point DATABASE_URL at a real Postgres instance
npx prisma migrate deploy                # applies the migration in prisma/migrations/
npm run db:seed                          # loads 6 example titles + reactions
npm run dev
```

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) — Server Components
  for reads, Server Actions for writes. See ARCHITECTURE.md for why this
  is a single Next.js app rather than a separate Python/FastAPI backend.
- **Prisma 7** + Postgres — schema in `prisma/schema.prisma`
- **Tailwind v4** — brand tokens (ink navy / marigold / rose) in
  `src/app/globals.css`
- **lucide-react** for icons

## Scripts

- `npm run dev` — local dev server
- `npm run build` / `npm run start` — production build/serve
- `npm run db:seed` — seed example titles (uses `prisma/seed.ts`)
- `npm run db:migrate` — `prisma migrate dev`
