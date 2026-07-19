# Kilig (flowcast) — Architecture

## Starting point

This repo began as an unmodified `create-next-app` + `prisma init` scaffold
(one commit, zero product code). Everything below was architected fresh —
there was nothing to refactor, so this is a build plan, not a migration plan.

## Stack decision: Next.js full-stack, not a separate Python backend

An earlier prototype used FastAPI (Python) + a separate React frontend.
Given this repo is already Next.js + Prisma + Vercel, the recommendation
is to **stay monolithic in Next.js** rather than resurrect a two-service
architecture:

- Server Components query Postgres directly via Prisma for reads — no
  REST API layer to maintain in parallel with the frontend.
- Server Actions (`src/lib/actions.ts`) replace mutation endpoints — no
  CORS, no duplicated request/response schemas between two languages.
- The v1 match-score algorithm (`src/lib/matching.ts`) is plain weighted
  Jaccard arithmetic — trivially fast in TypeScript. There's no ML here
  yet, so Python's data/ML ecosystem advantage doesn't apply.
- **When to reconsider:** if personalization later needs real ML
  (embeddings, trained models, heavier data pipelines), peel off a small
  Python service *just for that*, called from Next.js. Don't rewrite the
  whole app for a capability that isn't needed yet.

## Product philosophy (read before changing the UI)

1. **Emotion first, taxonomy invisible.** The homepage opens with mood
   chips ("What do you want to feel tonight?"), not a filter sidebar.
   Tropes/moods still power every query — see `src/lib/moodChips.ts` for
   the mapping from human feeling to taxonomy value — they're just not
   the first thing a user sees. Full taxonomy lives behind an `<details>`
   "Insights" disclosure on the detail page (`InsightsPanel.tsx`), not
   the default view.

2. **Match scores must always be honest.** A bare "88% Match" implies
   personalization the app doesn't have data for on day one.
   `getSimilarTitles()` in `src/lib/matching.ts` computes a real weighted
   tag-overlap score, and the UI always labels it ("N% match" shown on a
   card inside a "More like this" rail tied to a specific reference
   title) — never an unexplained bare percentage. See the docstring in
   that file for the exact formula and how to evolve it once real
   interaction-behavior data exists.

3. **Reactions before taxonomy.** The detail page shows curated "why
   people love it" quotes (`TitleReaction` model) before any tag chips —
   the emotional signal is the headline, the metadata is supporting
   evidence, not the other way around.

4. **Trending must be real or absent.** The trending rail on the
   homepage queries actual `clicked_out` interactions from the last 7
   days and renders nothing if there isn't any — never a fabricated
   trending list to fill space pre-launch.

## Information architecture

```
/                     Home — mood-first entry point
  ?mood=longing,revenge   URL-driven filter state (shareable, bookmarkable)
/title/[id]           Detail page — editorial order, honest match scores
/search?q=            Free-text results — name/synopsis/language match
```

Three routes, on purpose. `/search` is a plain `<form method="GET">`
(see `SearchBar.tsx`) rather than a client-side fetch — the browser
does the navigation itself, so the results page stays a Server
Component with zero extra client JS, same as everywhere else in this
app.

## Component hierarchy

```
app/
  page.tsx                 Server Component — reads searchParams, queries
                            Prisma directly, renders TrendingRail + MoodRail
                            sections in Suspense boundaries
  title/[id]/page.tsx       Server Component — title + reactions + availability
                            + similar titles, all fetched server-side
  search/page.tsx           Server Component — reads ?q=, Prisma `contains`
                            match on name/synopsis/language (mode: insensitive)

components/
  SearchBar.tsx              Server Component — plain <form method="GET">,
                            no client JS; browser navigates to /search?q=
  MoodChipBar.tsx           Client Component — only one that needs client JS;
                            toggles chips by pushing to the URL, not local state
  TitleCard.tsx             Server Component — Link-based nav, phone-bezel card
  TitleRail.tsx             Server Component — horizontal scroll wrapper
  ReactionsList.tsx         Server Component — "why people love it" quotes
  InsightsPanel.tsx         Server Component — native <details>, no client JS
  WatchButton.tsx           Client Component — needs onClick to fire a Server
                            Action (log click) then window.open() the deep link

lib/
  prisma.ts                 Singleton Prisma client (dev hot-reload safe)
  moodChips.ts              Mood/trope taxonomy → emotion-label mapping
  matching.ts                Honest match-score algorithm + getSimilarTitles()
  session.ts                 Anonymous session cookie (interaction tracking
                              without requiring accounts)
  actions.ts                 All Server Actions — interaction logging + admin
                              mutations (create title, add availability/reaction)
```

**Why so few Client Components:** almost everything is server-rendered.
The only genuine client-side state is the mood chip selection (and even
that lives in the URL, not React state) and the watch-button click
handler (which needs `window.open`). This keeps the bundle small and
avoids the classic Next.js mistake of marking whole pages `"use client"`
by default.

## Data model

See `prisma/schema.prisma`. Six models: `Title`, `Availability`,
`Producer`, `TagDefinition`, `TitleReaction`, `UserInteraction`. Ported
directly from the earlier Postgres/FastAPI design — same reasoning
applies (see inline comments in the schema file), just expressed as
Prisma models with `@map`/`@@map` to keep snake_case in the actual
database while giving TypeScript idiomatic camelCase field names.

## What's deliberately NOT built yet

- **Auth on admin Server Actions** (`createTitle`, `addAvailability`,
  `addReaction` in `actions.ts`) — fine while you're the only one
  calling them; add a check before anyone else gets access.
- **Personalized (behavioral) match scoring** — needs real interaction
  volume first. The honest v1 score is tag-overlap only.
- **Producer self-serve submission** — start by seeding/curating titles
  and reactions yourself (`prisma/seed.ts` has a working example).
- **User accounts** — session-cookie-based interaction tracking works
  without them.
- **Search-query logging** — `logSearch()` in `actions.ts` is still a
  stub (console.log only). `/search` itself is built, but the query
  isn't persisted: the `UserInteraction` schema requires a `titleId`,
  so a search event (which isn't about one title) needs either a
  nullable `titleId` or a separate `SearchLog` model. Deferred until
  you actually need the data.

## Next build candidates, in likely order

1. Get a real Postgres database (Vercel Postgres, Supabase, or Neon all
   work fine with Prisma), run `npx prisma migrate dev`, then
   `npm run db:seed` to load the 6 example titles.
2. Seed 50-100 real titles with real reactions — this is the point
   where you find out if the taxonomy actually holds up against real
   content, not hypothetical categories.
3. Add lightweight admin auth (even a single shared password behind a
   cookie is fine at this stage) before letting anyone else touch the
   Server Actions.
4. Persist search queries (see the `logSearch()` gap above) once you
   want that data feeding the recommendation flywheel.
5. Once `UserInteraction` has real volume: blend a behavioral similarity
   term into `computeMatchScore()` and let the score graduate from
   "tag-overlap similar" to genuinely "personalized."
