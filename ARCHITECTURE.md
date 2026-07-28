# Kilig — Architecture

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
   interaction-behavior data exists. `TaxonomySignal.tsx` extends this:
   instead of asking the person to trust one blended number, it shows
   which specific tags are doing the work — for each of the title's own
   tags, what share of the "More like this" set also carries it. No new
   query, no fabricated confidence score — `computeTagAlignment()` just
   counts across the same candidate list already fetched for the rail.

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
  TitleCoverArt.tsx          Server Component — shared cover-art fallback (see
                            below); used by both TitleCard and the detail-page
                            hero so the gradient treatment can't drift out of
                            sync between them again
  TitleRail.tsx             Server Component — horizontal scroll wrapper
  ReactionsList.tsx         Server Component — "why people love it" quotes
  InsightsPanel.tsx         Server Component — native <details>, no client JS
  TaxonomySignal.tsx        Server Component — per-tag alignment bars, native
                            <details>; see computeTagAlignment() in matching.ts
  WatchButton.tsx           Client Component — needs onClick to fire a Server
                            Action (log click) then window.open() the deep link
  ViewLogger.tsx             Client Component, renders null — fires
                            logInteraction() on mount via useEffect instead of
                            during the page's render body. See "Cookie writes"
                            note below.
  SearchLogger.tsx           Same pattern as ViewLogger.tsx, for logSearch()

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

1. ✅ Real Postgres database — a Supabase project, schema applied,
   6 example titles seeded. (Note: the original Supabase project
   created earlier in this build, named `flowcast`, is orphaned —
   the actual `DATABASE_URL` in use points at a different, later
   project. Fine to delete the `flowcast` one if you want to tidy up
   your Supabase org; nothing depends on it.)
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
- **`db:seed` was silently connecting to the wrong database** —
  `npm run db:seed` called `tsx prisma/seed.ts` directly, bypassing
  Prisma's CLI entirely. `prisma.config.ts` loads `.env` via
  `process.loadEnvFile()`, but only when Prisma's CLI executes that
  config file first; a bare `tsx` invocation never triggers it, so
  `DATABASE_URL` was `undefined` and `node-postgres` silently fell
  back to its own default (local socket, OS username as both user and
  database name) instead of erroring loudly. Fixed by routing through
  `prisma db seed`, which loads the config first — same as
  `prisma migrate deploy` already did correctly.

## Homepage visual pass

Two real gaps, not a "needs redesign" problem — the dark/marigold/rose
palette was already the intended look, it just wasn't showing up:

- **`TitleCard.tsx` had no color for titles without licensed cover
  art** — the fallback was a flat gray gradient with a single letter.
  Every seeded title lacks `coverImageUrl` (real art should come from
  platform partners, not be generated — see the Data model section),
  so in practice every card looked identical and colorless. Replaced
  with a deterministic (per title id) gradient pulled from the actual
  brand palette plus the full title name overlaid, so cards read as
  intentional and visually distinct from each other even before any
  real artwork exists.
- **`MoodChipBar.tsx` only showed color on the active chip** — every
  chip at rest was the same flat gray regardless of type, so the
  whole selector read as monochrome until you clicked something. Now
  trope chips are marigold-tinted and mood chips are rose-tinted even
  at rest, extending the same dual-accent rule `TaxonomySignal.tsx`
  already uses for trope vs. mood alignment bars.
- **First-open could show zero cards depending on the mood-chip
  overlap** — the homepage previously only rendered Trending (always
  empty pre-launch, needs real interaction volume) and whichever mood
  rails happened to match. Added an unconditional "New on Kilig" rail
  between them, ordered by `createdAt`, that shows as long as at least
  one title is published — regardless of trending data or which mood
  chips are active.

**Follow-up round**, after seeing this in the browser for real:

- The gradient fallback above only got applied to `TitleCard.tsx` (the
  small rail cards) — the detail page's own hero image had an
  identical but separately-written fallback that never got the fix,
  so it still showed the old flat gray box with one letter. Extracted
  both into a shared `TitleCoverArt.tsx` so this exact drift — two
  copies of the same fallback silently diverging — can't happen a
  third time.
- Overlaid title text changed from off-white to marigold, since white
  text is where most of the page's copy already reads, and a
  distinguishing accent color reads more like real cover art typography.
- Rail cards were a fixed 132px, sized for a mobile viewport
  regardless of screen size. Now `132px → 160px (sm) → 190px (lg)`.

## Cookie writes only happen from real Server Action calls

`logInteraction()` and `logSearch()` both call `getSessionId()`
(`lib/session.ts`), which sets a cookie on a visitor's first
interaction. Next.js only allows cookie *mutation* inside an actual
Server Action invocation or Route Handler — not during a Server
Component's render, even when the function being called is itself
marked `"use server"`. Calling a Server Action function directly from
a page's render body is just a plain async function call as far as
that restriction is concerned; it doesn't go through the request
lifecycle that makes cookie writes legal.

`title/[id]/page.tsx` and `search/page.tsx` originally called
`logInteraction()`/`logSearch()` directly in their render bodies —
worked most of the time (existing sessions just read the cookie), but
threw `Cookies can only be modified in a Server Action or Route
Handler` for any visitor without one yet. Fixed by moving both calls
into tiny Client Components (`ViewLogger.tsx`, `SearchLogger.tsx`)
that fire the same Server Action from a `useEffect` on mount instead —
that IS a genuine action invocation, same as `WatchButton.tsx`'s
`onClick` already correctly does. If you add another fire-and-forget
log call anywhere, route it through a Client Component the same way
rather than calling it inline during a page's render.

## Ship-readiness pass

- **Renamed `package.json`/`package-lock.json` from `flowcast` to
  `kilig`.** The GitHub repo URL itself is still `.../flowcast` —
  intentionally not renamed (see the note at the top of this repo's
  README for why that's fine).
- **Per-title and site-wide OG images** — `title/[id]/opengraph-image.tsx`
  redirects to the real `coverImageUrl` when one exists, otherwise
  generates the same gradient+title treatment as `TitleCoverArt.tsx`
  via `next/og`'s `ImageResponse` (re-expressed in plain CSS, since
  Satori doesn't read Tailwind classes). `src/app/opengraph-image.tsx`
  covers every other route with a generic branded card. Previously,
  every shared link had zero preview image — every seed title lacks
  `coverImageUrl`, so this was silently broken for 100% of current
  content, not an edge case.
- **`robots.ts`** disallows `/admin` from being indexed. **`sitemap.ts`**
  lists every published title. Both read `NEXT_PUBLIC_SITE_URL`, which
  isn't set yet since the domain isn't registered — they degrade
  gracefully (empty sitemap, no sitemap line in robots.txt) rather
  than guessing a domain. Set it once you've registered one.
- **`not-found.tsx`** — branded 404 instead of Next's default, for the
  (now fairly common) case of an unpublished title or a bad link.
- **`icon.tsx`** replaces the default Next.js favicon with a generated
  Kilig mark, same `ImageResponse` technique as the OG images.
- **A deliberate delay on failed admin logins** (`admin.ts`) — cheap
  brute-force mitigation appropriate for a single-shared-password
  gate; see the comment there for what this does and doesn't protect
  against, and when it'd be worth a real rate limiter instead.

**Still open, needs a human decision, not a code fix:**
- No `LICENSE` file in the repo.
- The actual domain (`.tv` under the VeeReel umbrella, or a `kilig.*`
  alternative) isn't registered yet — `NEXT_PUBLIC_SITE_URL` and the
  Vercel deploy's production domain both depend on that.
- Full `next build` still hasn't been verified end-to-end from this
  sandbox (blocked reaching `binaries.prisma.sh` and Google Fonts) —
  worth confirming via Vercel's own build, which has normal internet
  access.

## Mobile pass

Real on-device testing surfaced four issues no amount of desktop
DevTools simulation would have caught:

- **The whole page could scroll horizontally**, not just the rails —
  something (never fully isolated) was overflowing the viewport
  width, and with no `overflow-x-hidden` safety net anywhere, that
  overflow propagated all the way up to the page itself. Felt like
  "the whole page moves sideways as one plate" and could cut off text
  requiring horizontal scroll to read. Fixed with `overflow-x-hidden`
  on both `<html>` and `<body>` in `layout.tsx` — a page-level
  backstop that holds regardless of which element is the actual
  source, rather than chasing down one specific culprit.
- **Rails didn't feel gesture-isolated from the page** — a horizontal
  swipe on a rail could get ambiguously read as a vertical page-scroll
  gesture too if it wasn't perfectly horizontal. **Attempted fix,
  reverted**: `touch-pan-x` on each rail's scroll container caused a
  worse regression on real iOS Safari — the whole page's vertical
  scroll could get stuck entirely, requiring a reload to recover. This
  is a known real-world quirk of `touch-action` values other than
  `auto`/`none`/`manipulation` combined with nested scrollables on
  WebKit, not something visible in any simulator. `scroll-snap` alone
  (still in place) is the safer bet for "feels like independent rows"
  and doesn't carry this risk. Lesson: don't stack an unverifiable,
  device-only-testable CSS change on top of something already working
  without a way to confirm it before shipping it.
- **Cards were sized smallest-first** — `132px` was the *base* (mobile)
  width, with `sm:`/`lg:` making them bigger on larger screens. Exactly
  backwards for a product that's mobile-first in practice: bumped to
  `164px → 180px (sm) → 200px (lg)` for real legibility on an actual
  phone, at the cost of fewer cards visible per row.
- **Duplicate title on the detail-page hero, mobile only** — the
  gradient fallback's overlaid title sits directly above the page's
  real `<h1>` once the layout collapses to one column below `sm:`,
  reading as the name printed twice in a row. `TitleCoverArt.tsx` now
  takes a `showTitleOverlay` prop (default `true`, so rail cards are
  unaffected); the detail-page hero passes `false` since a real
  heading already sits right below it.
- **The homepage `<h1>` got clipped, not just scrollable** —
  `overflow-x-hidden` (above) fixed the whole-page horizontal-scroll
  symptom, but it didn't fix whatever was actually overflowing — it
  just turned "annoying sideways scroll" into "content silently cut
  off and unreachable," which is worse. Added `break-words` to every
  heading that renders variable-length content (the homepage
  headline, and both places a title's own `name` is rendered as an
  `<h1>`) as a hard guarantee against this class of bug, and removed
  a vestigial `flex flex-col` from `<body>` (no footer ever used it —
  it was create-next-app boilerplate) since flex containers are a
  common source of exactly this kind of width-blowout quirk and it
  wasn't accomplishing anything.
