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
  admin.ts                   Single-password admin gate — isAdminSession(),
                              requireAdmin(), login/logout Server Actions
  adminForms.ts               FormData → typed-args adapters around the
                              actions.ts mutations, for use as <form action=>
  actions.ts                 All Server Actions — interaction logging + admin
                              mutations (create title, add availability/reaction),
                              each gated by requireAdmin()

admin/login/page.tsx        Password form (Client Component, useActionState)
admin/page.tsx               Protected landing — lists titles, links to each
admin/titles/new/page.tsx    Create-title form
admin/titles/[id]/page.tsx   Title detail — add availability/reaction forms
```

**Why so few Client Components:** almost everything is server-rendered.
The only genuine client-side state is the mood chip selection (and even
that lives in the URL, not React state) and the watch-button click
handler (which needs `window.open`). This keeps the bundle small and
avoids the classic Next.js mistake of marking whole pages `"use client"`
by default.

## Data model

See `prisma/schema.prisma`. Seven models: `Title`, `Availability`,
`Producer`, `TagDefinition`, `TitleReaction`, `UserInteraction`,
`SearchLog`. Ported directly from the earlier Postgres/FastAPI design —
same reasoning applies (see inline comments in the schema file), just
expressed as Prisma models with `@map`/`@@map` to keep snake_case in
the actual database while giving TypeScript idiomatic camelCase field
names.

## What's deliberately NOT built yet

- **Real accounts for admin** — `lib/admin.ts` is a single shared
  `ADMIN_PASSWORD` behind an httpOnly cookie, not a users table. Fine
  for one person; move to real accounts before more than one person
  needs access, or before the admin mutations do anything higher-stakes
  than title curation.
- **Producer self-serve submission** — start by curating titles and
  reactions yourself via `/admin/titles/new`, or `prisma/seed.ts` for
  bulk loads.
- **User accounts (for visitors)** — session-cookie-based interaction
  tracking works without them.
- **Fully personalized match scoring** — `matching.ts` now blends a
  behavioral (session co-occurrence) term into `computeMatchScore()`,
  but only once a title has ≥5 qualifying sessions
  (`MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL`); below that it's still pure
  tag-overlap. It's also still title-to-title similarity, not
  personalized to the *viewing* user's own history — that's the next
  real step once there's enough per-user signal to justify it.

## Roadmap status

All four items from the original "next build candidates" list are
done as of this writing:

1. ✅ Real Postgres database — Supabase project `flowcast`
   (`eu-central-1`), schema applied, 6 example titles seeded.
2. ✅ Admin data-entry form — `/admin/titles/new` (create) and
   `/admin/titles/[id]` (add availability/reaction), both routed
   through `adminForms.ts` → the `requireAdmin()`-gated mutations in
   `actions.ts`.
3. ✅ Search-query persistence — `SearchLog` model, `logSearch()`
   actually writes to it now.
4. ✅ Behavioral blend on match score — see `matching.ts` docstring.

Next candidates, roughly in order of what unlocks the most:

1. Seed 50-100 real titles with real reactions via `/admin/titles/new`
   — this is the point where you find out if the taxonomy actually
   holds up against real content, not hypothetical categories.
2. Once there's real per-*session* browsing history (not just
   per-title aggregate), consider whether personalizing to the
   viewing user's own history is worth the added complexity and the
   UI-honesty rewrite that comes with it (the score copy would need
   to change from "N% match with X" to something claiming personal
   relevance).
3. Real accounts for admin once more than one person needs access.
4. Producer self-serve submission once there's enough volume that
   curating everything yourself doesn't scale.

## Audit fixes (post-roadmap)

A full pass over the codebase turned up a few issues, since fixed:

- **Draft-title leak** — `/title/[id]` was the one direct-by-id query
  that didn't filter `isPublished: true` like every other query does.
  Now 404s for non-admins; admins see a "Draft — only visible to you"
  badge instead. `generateMetadata()` on the same route enforces the
  identical check independently, since it runs outside the page
  component and would otherwise leak a draft's name/synopsis into
  `<head>`/OG tags for link-preview bots even while the page 404s.
- **Next.js CVEs** — bumped `16.2.10 → 16.2.11`, clearing the core
  advisories (Server Action DoS, SSRF, cache confusion, middleware
  bypass). Remaining `npm audit` noise is from `postcss`/`sharp`
  bundled inside Next's own `node_modules`; npm's advisory range for
  those is too broad to be actionable (its suggested "fix" is
  downgrading to a years-old Next version).
- **Tag taxonomy now actually enforced** — `createTitle()` normalizes
  trope/mood/cast-type values and auto-registers any new ones into
  `TagDefinition` via `ensureTagDefinitions()`. Previously
  `TagDefinition` was written by the seed script but never read
  anywhere, so a typoed tag would save silently and just never match
  anything in `MoodChipBar` or the match-score tag-overlap logic.
- **Per-title SEO/social metadata** — `title/[id]/page.tsx` now has
  `generateMetadata()` (title, description, OpenGraph, Twitter Card),
  and the root layout uses a title template (`%s · Kilig`) so child
  routes don't need to repeat the site suffix. The Prisma call is
  shared between `generateMetadata` and the page component via
  React's `cache()`, so it only runs once per request.
- Removed `fix.sh`, a one-time script whose patch had already landed
  and been committed.
