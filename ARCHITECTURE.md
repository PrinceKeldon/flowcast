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
                              mutations (full CRUD on Title, Availability,
                              TitleReaction), each gated by requireAdmin()
  fetchTitleMetadata.ts       Server Action — pulls name, synopsis, cover
                              image, and detected platform out of a page's
                              own preview meta tags, for the "Fetch details
                              from a link" field in the admin title form.
                              Admin-only, light SSRF guard (blocks
                              loopback/private-network hosts).

admin/login/page.tsx        Password form (Client Component, useActionState)
admin/page.tsx               Protected landing — lists titles, links to each
admin/titles/new/page.tsx    Create-title form
admin/titles/[id]/page.tsx   Title detail — edit/delete title, per-item
                              edit/delete on availability, per-item delete
                              on reactions, plus the add forms for both
admin/titles/[id]/edit/page.tsx  Edit-title form, pre-filled
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
- **Duplicate title, both the detail-page hero and rail cards** — the
  gradient fallback's overlaid title sat directly above a real heading
  in both places: the detail-page `<h1>` (mobile only, once the layout
  collapses to one column) and every `TitleCard`'s own caption below
  the image (always, any viewport). `TitleCoverArt.tsx`'s
  `showTitleOverlay` prop (default `true`) is now explicitly passed
  `false` at both call sites —
  `TitleCard.tsx` and the detail-page hero — since both already show
  the name right next to the art. (Tried switching the caption to
  `--accent-rose` since it was now the only title on the card — reverted,
  it dampened the homepage's overall mood. Stayed `--text`, off-white.)
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

## Fetch title details from a link

`/admin/titles/new` and the edit form both open with "Fetch details
from a link," backed by `fetchTitleMetadata()` (originally
`fetchOgImage()` — cover-art-only; expanded to cover name, synopsis,
and cover image together, one button, after the narrower version
proved out). Reads a page's own preview metadata — `og:title`,
`og:description`, `og:image`/`twitter:image`, `og:site_name` — the
same mechanism link-preview bots use, not an LLM (the AI-auto-fill
idea discussed earlier stays shelved as premature for the MVP; this
is the zero-new-dependency version of the same instinct). Also
surfaces a "Detected platform" note from `og:site_name` when present —
informational only, since availability is added as a separate step
after the title itself is saved, not something this form can prefill
directly.

Known limitation, unchanged from the original version: several source
platforms are more app-native than web-native, so their public pages
may carry little or no usable metadata — when that happens the fields
just stay empty (or keep whatever was already typed) and the admin
fills them in manually. Every fetched field is a first draft to
review, not a final answer — a synopsis pulled from `og:description`
is written for SEO/marketing, not necessarily Kilig's voice or length.

`TitleDetailsFetcher.tsx` is the one place in the admin title forms
that's a Client Component rather than a plain `<form action=>` — it
needs local state to hold the fetch result (and let the admin freely
edit it) before the surrounding form submits, which a zero-JS server
form can't do on its own. Everything else in both forms stays
server-rendered.

## Full CRUD on Title, Availability, and TitleReaction

Every admin mutation used to be create-only — there was no way to fix
a wrong deep link or a typo without deleting and re-seeding the whole
title. Added:

- **Title**: `/admin/titles/[id]/edit` (pre-filled form) and a
  "Delete title" control on the detail page, behind a `<details>`
  disclosure requiring an explicit second click on a clearly-labeled
  destructive button — same zero-JS "are you sure" pattern the "+ Add"
  forms already used, no `confirm()` dialog needed. Delete cascades
  to that title's `Availability`, `TitleReaction`, and
  `UserInteraction` rows at the DB level (see `schema.prisma`'s
  `onDelete: Cascade`), so nothing orphaned is left behind.
- **Availability**: per-item inline "Edit" (pre-filled, same disclosure
  pattern) and "Delete" on `/admin/titles/[id]`. This was the specific
  gap that prompted the whole pass — a wrong `deepLinkUrl` had no fix
  except adding a second, correct entry alongside the broken one.
- **TitleReaction**: per-item "Delete" only, not edit — a short quote
  is about as much effort to delete-and-retype as to edit in place, so
  edit-in-place wasn't worth the extra form for now. Easy to add later
  if that judgment turns out wrong.

`actions.ts` now shares tag normalization + `TagDefinition`
registration between `createTitle` and `updateTitle` via
`normalizeAndRegisterTags()`, so editing a title's tags goes through
the identical taxonomy-growing logic as creating one — previously
this only would have run once and an edit could have silently
bypassed it if update had been added carelessly.

## Discovery Engine (`/admin/discovery`)

A plugin-based system for importing multiple titles at once, landed
in `e79c82b` and reworked immediately after in the same session. The
architecture is genuinely good and worth understanding on its own
terms before the policy correction below:

- `lib/discovery/types.ts` — the shared contract. A `DiscoveryPlugin`
  implements `supports(url)`, `discover(request)` (returns candidate
  URLs), and `importTitle(url)` (fetches one page, returns a
  structured result). Everything downstream of `discover()` —
  duplicate detection, draft creation, the live summary UI — only
  ever deals in URLs and doesn't care where the list came from.
- `lib/discovery/registry.ts` + `registry-init.ts` — plugins register
  themselves by source name; nothing else imports a plugin module
  directly. Adding a source is "write a plugin file, add one line."
- `lib/discovery/plugins/` — one file per source. `dramabox.ts` is a
  deliberate non-implementation: a direct fetch against DramaBox's
  own `/browse` page returned a confirmed bot-detection block, and
  the honest response was to not attempt to defeat it (no headless
  browser, no fingerprint evasion) — it's still registered so the
  admin UI can show "DramaBox: known but unavailable" instead of
  silently omitting it.
- `lib/discovery/webExtract.ts` — fetches a page and reads its own
  `og:`/`twitter:` meta tags, the same mechanism `fetchTitleMetadata.ts`
  uses for the single-URL admin form. No AI, no JS execution.

**The correction**: `reelshort.ts` and `shortmax.ts` originally
implemented `discover()` by fetching each platform's own shelf/listing
page (`reelshort.com/shelf/...`, ShortMax's homepage) and
regex-extracting every episode/drama link on it — automated
enumeration of a platform's catalog, not a human choosing individual
links. That's scraping regardless of how politely it's implemented
(no bot-detection bypass, reasonable timeouts, draft-only import —
all genuinely careful engineering), and it almost certainly runs
against both platforms' Terms of Service, which is close to universal
boilerplate against automated crawling on consumer platforms. It's
also a direct, asymmetric risk to the actual product: ReelShort and
ShortMax are literally the platforms Kilig's "watch on" deep-linking
depends on — getting noticed and blocked by either would damage the
one relationship the whole product needs. This also reverses the
project's founding decision, made before any code existed: the
original design doc explicitly considered and rejected
"scraping/aggregating public listings" as the MVP content strategy,
for exactly this reason.

Both plugins now only support mission `"manualUrls"` — the admin
pastes a list of links they specifically found and chose (via
verticaldrama.tv's public rankings, or a platform's own trending
page, read by a human) into `DiscoveryMissionRunner.tsx`'s textarea.
The shelf-fetching code and `webExtract.ts`'s `extractLinks()` helper
(the actual scraping primitive) were removed entirely, not disabled
behind a flag — nothing left reachable to accidentally turn back on.
`importTitle()` — fetching one page a human chose — was never the
concern and is unchanged.

If either platform ever offers an official data partnership or API,
that's what these plugins should be rewritten against — same
distinction the DramaBox stub already draws.

## Mock titles removed from prisma/seed.ts

The 6 fictional example titles (The Light Between Oceans, Portrait of
a Lady on Fire, His Secret Baby, Revenge After Betrayal, The CEO's
Contract Wife, Surrender to Love) are gone from the seed script —
real titles now go in via `/admin/titles/new` or the Discovery
Engine. `TAG_DEFINITIONS` stayed: that's a real, useful starting
taxonomy, not mock content, and new tags beyond it auto-register as
admins tag real titles anyway (see `normalizeAndRegisterTags()` in
`lib/actions.ts`). Re-running `npm run db:seed` against a database
that already has the old mock rows in it won't remove them — this
only changes what a *fresh* seed creates. Existing mock rows need
deleting directly, either through `/admin`'s per-title delete or a
one-time SQL cleanup.

## Intro splash (`IntroSplash.tsx`)

A ~2.5s black-background opening transition, mounted once in the root
layout so it covers any entry point, not just `/`. The word "Kilig"
uses the exact same classes as the existing homepage eyebrow label
(`font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]`)
— no new styling invented, per an explicit "no design changes"
instruction. Shows once per browser session (`sessionStorage`), not
on every internal navigation.

Worth understanding why this one Client Component looks more
elaborate than most others in the app: `useState(true)` as the
initial value (not `false`) is deliberate, not a bug — it makes the
server-rendered HTML and the client's first hydration pass agree
("splash visible"), avoiding both a hydration-mismatch warning and a
flash of the real homepage before the splash appears. Suppressing it
for a repeat view within the same session happens in
`useLayoutEffect` rather than `useEffect`, specifically because
`useLayoutEffect` runs before the browser paints — so a returning
visitor never sees the splash flash on and immediately off, they just
never see it at all.

## Reaction tap + "Trending in the Fandom"

Two small, related additions on top of the existing anonymous-session
interaction system — no accounts, no comments, no free text.

**Reaction tap** (`ReactionTap.tsx`, on `/title/[id]`): a single-tap
anonymous emoji reaction, reusing `UserInteraction` rather than a new
table — `reacted` was added to the `InteractionAction` enum, and which
emoji got tapped lives in the existing `metadata` JSON column
(`{ emoji: string }`), same shape `logInteraction()` already uses for
`clicked_out`'s `{ platform: string }`. `logReaction()` in
`actions.ts` is the write path; unlike `logInteraction()` (which is
pure fire-and-forget and swallows every error), it has to report back
so the client can show honest state — did the tap land, or had this
session already reacted.

*Enforcement is in the database, not the application.* One reaction
per session per title is a **partial unique index** —
`(session_id, title_id)` scoped to `WHERE action = 'reacted'` — not a
blanket `@@unique` across `UserInteraction`, which would incorrectly
forbid a session from having its normal multiple `viewed_detail` /
`clicked_out` rows for the same title. Prisma's schema language has no
way to express a `WHERE`-scoped unique index, so this constraint is
invisible in `schema.prisma` beyond a comment pointing here — it only
exists in the hand-written migration. `logReaction()` catches Prisma's
`P2002` violation code as the expected shape of "already reacted",
distinct from a genuine unexpected failure.

*Why two migration files, not one:* `prisma/migrations/`
`20260802120000_add_reacted_interaction_action` adds the enum value
alone, and `20260802120100_add_reaction_uniqueness_index` (a separate,
later migration) adds the partial index that references it. PostgreSQL
won't let a newly-added enum value be *used* — including in an index
predicate — within the same transaction that added it; combining the
two into one file fails the first time it runs against a real
database, not in a way that shows up testing against an
already-migrated one. This project's migrations are hand-assembled
rather than generated by `prisma migrate dev` (no live DB connection
available in the build environment used so far), so getting this
ordering right by hand mattered more than usual here.

*Client-side UX layered on top, not instead of, the real constraint:*
`title/[id]/page.tsx` does a **read-only** session check
(`peekSessionId()`, a new addition to `session.ts` alongside
`getSessionId()` — returns the existing session id or `null`, never
writes a cookie) so a returning visitor sees their own prior reaction
pre-disabled on page load, not just after a rejected tap. `getSessionId()`
itself still can't be called from a page's render body — see "Cookie
writes only happen from real Server Action calls" above — this sidesteps
that by never needing to *create* a session just to check whether one
already reacted.

**"Trending in the Fandom"** (homepage, `FandomTrendingRail()` in
`page.tsx`): a second, separately-labeled trending rail, ranking
titles by `reacted` interaction volume in the last **48 hours** —
deliberately not merged with the existing `TrendingRail` (which ranks
by `clicked_out` volume over 7 days). Same "trending must be real or
absent" principle as the original rail: empty result renders nothing,
no fallback list. The two rails answer different questions — what
people are actually watching vs. what's getting an emotional reaction
right now — and blending them into one score would quietly erase that
distinction the same way an unlabeled match score would. The eyebrow
copy says so explicitly ("Trending in the Fandom · reactions, last
48h") rather than relying on the reader to infer it from position on
the page. 48h instead of matching the existing rail's 7-day window:
reactions are a lower-volume signal than clicks (one tap vs. every
click-through), so a shorter window keeps the section about *current*
buzz instead of slowly converging on the same titles `TrendingRail`
already surfaces.

Reuses `TitleRail.tsx` as-is (it already handles empty-list hiding and
the card grid) rather than a parallel rail component — the only thing
that differs between the two trending rails is the query and the label
passed in.

## Skip Meter + metadata field reframing

**Skip Meter** is the genre-specific "killer feature" this app was
missing — vertical-drama viewers' real anxieties are padding, slow
starts, and unclear payoff, and this addresses that directly rather
than with generic streaming-app fluff. Built in two stages, both live
in the codebase now even though Stage 2's *display* stays gated behind
real traffic — same discipline as the behavioral match-score blend.

**Stage 1 (editorial)** — `Title.editorialHookPoint` /
`editorialEndingType`, filled in via `/admin/titles/new` and the edit
page. This is the curator's own honest read, not a fake aggregate —
and deliberately scoped to what's actually achievable: the curator
can't realistically watch every episode of every title added, so
`hookPoint` (hooks fast / slow burn / filler-heavy) is the primary
field, genuinely judgeable from 1-2 episodes, while `endingType` is
optional and only meant to be filled in once a title's actually been
finished — never guessed to fill the field.

**Stage 2 (community)** — the "when did it hook you?" vote
(`SkipMeter.tsx`, on `/title/[id]`), using the same anonymous
one-vote-per-session-per-title infrastructure as the reaction tap: a
new `hook_vote` `InteractionAction`, enforced by another partial
unique index (see schema.prisma's comment on `UserInteraction`, and
the three-migration split in `prisma/migrations/` —
`20260803120000_add_skip_meter_editorial_fields` for the new enum
types + Title columns in one safe transaction, then
`20260803120100_add_hook_vote_interaction_action` and
`20260803120200_add_hook_vote_uniqueness_index` split the same way as
`reacted` was, for the same Postgres enum-commit reason).

*Exact episode number, not fixed buckets.* An earlier version of this
used fixed checkpoints (ep1/ep3/ep9/never) across every title — wrong,
caught during manual testing: episode count varies from a handful to
over a hundred across this catalogue, so a fixed "Ep 9" option doesn't
exist for a 6-episode title and is far too coarse for a 60-episode
one. `metadata` instead stores the literal episode number:
`{ hookedAtEpisode: number | null }`, `null` meaning "never got into
it" rather than a missing value. `logHookVoteFromForm()` in
`actions.ts` validates the submitted number against the title's actual
`episodeCount` server-side — the form's `max` attribute is a UX hint,
never enforcement.

*A real `<form action>`, not a client `useTransition` call.* Unlike
`ReactionTap.tsx`/`logReaction()`, this isn't a justified Client
Component island — it's a genuine form submission, matching this
app's dominant server-first pattern more closely than the earlier tap-
button version did. `SkipMeter.tsx` has no `"use client"` at all: it
renders the form when `priorVote` (computed server-side via the same
read-only session peek as the reaction lookup) is `null`, or the
recorded vote as plain text when it isn't — the database is the only
source of truth, there's no client state to keep in sync with it. A
submission just makes the page re-render on the next request.

The one non-negotiable piece: `getHookVoteSummary()` in `actions.ts`
won't return an aggregate below `MIN_VOTES_FOR_SKIP_METER_DISPLAY`
(mirrors `matching.ts`'s `MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL` —
same reasoning, a handful of votes isn't a real signal, it's noise
wearing a percentage sign). Voting still works and still counts below
that threshold — the form always renders — only the aggregate stat
display waits for real sample size, silently, the same way
`TrendingRail`/`FandomTrendingRail` render nothing rather than an
empty or fake list. Built now, sitting there, validated by real
traffic rather than blocked on it. The aggregate reports the *median*
hooked-at episode, not the mean — median resists one outlier vote
("episode 47") dragging the number around at these small sample sizes,
which matters more here than with real volume.

Aggregation happens in application code (fetch every `hook_vote` row
for a title, compute the median in JS) rather than a database query,
because `hookedAtEpisode` lives inside the `metadata` JSON column,
which Prisma can't median/group by directly — same reasoning
`duplicate.ts` already used for title-similarity comparison. Fine at
this project's scale; revisit if a single title's vote count ever
gets large.

**Metadata field reframing**, prompted by real curation friction:

- *Language* was answering the wrong question. The field isn't
  "original production language" (often unknowable, and not what a
  viewer choosing what to watch actually needs) — it's "what can
  someone watch this in, on Kilig, right now." Relabeled to "Viewing
  language" on both admin forms, defaults to `en` since that's true
  for everything currently curated. If a title later has multiple
  confirmed dub/sub options worth showing, that's a real reason to
  make this an array — not built now for a problem that doesn't exist
  yet.
- *Country of origin* and *availability regions* are both captured in
  the admin but not displayed anywhere on the public site yet — so
  both admin forms now say so directly ("Not shown publicly yet — skip
  if unsure") rather than silently costing the curator research time
  on fields with zero current effect. If region-aware display ever
  becomes real, that's the moment to define an honest convention for
  "confirmed everywhere" vs. "unconfirmed" — not before.
- *Episode count* auto-fetch was added to `fetchTitleMetadata.ts`,
  alongside name/synopsis/cover-image. Two-tier, honestly labeled:
  schema.org JSON-LD `numberOfEpisodes` first (genuinely reliable when
  a platform includes it), falling back to matching phrasing like "24
  Episodes" in the page's visible text (a real best-effort guess, not
  a guarantee). `episodeCountSource` on the result tells
  `TitleDetailsFetcher.tsx` which path produced it, so the admin form
  shows a confidence note rather than presenting a text-pattern guess
  with the same weight as structured data — and editing the field
  manually clears that provenance, since it's no longer attributable
  to the fetch. This required removing the old head-only byte-read
  shortcut in `fetchTitleMetadata.ts` (episode counts can live in the
  body, not just `<head>`), so the byte cap moved from 200KB to 400KB
  to compensate.

## Duplicate detection on manual creation + title seasons

Two real gaps, found by asking rather than by testing, and related
enough to fix together.

**The gap:** `checkDuplicate()` (bigram-similarity name matching,
`lib/discovery/duplicate.ts`) existed and worked, but was only ever
called from the Discovery Engine's automated mission runner
(`mission.ts`) — never from `/admin/titles/new`, the actual path
almost every title gets created through now that platform
auto-crawling was walked back to manual entry. Nothing stopped the
same title (or the same URL) from being entered twice.

**Why it couldn't just be wired in as a hard block:** vertical dramas
routinely get sequel seasons, and this catalogue had no concept of
that at all — "Show Name Season 2" would score as a near-duplicate of
"Show Name" under the exact same check meant to catch accidental
re-entry, with no way to say "yes, I know, that's intentional."
Fixing the duplicate gap properly meant building season-linking first,
not after.

**Title seasons** (`Title.seasonOfId` / `seasonNumber` in
schema.prisma, migration `20260804120000_add_title_seasons`): Season
2+ is its own independent `Title` row, not a bumped `episodeCount` on
the original — confirmed against how these platforms actually work,
Season 2 nearly always gets its own distinct watch link, sometimes on
a different platform entirely, so it needs its own
`Availability`/reactions/Skip Meter data. `seasonOfId` just links the
rows: Season 1 (or a standalone title) has `seasonOfId = null`, every
later season points back at the same root rather than chaining
(season 3 → season 2 → season 1), so "show me every season" is one
query (`id = root OR seasonOfId = root`) instead of a recursive walk.
The public `/title/[id]` page shows a small Season 1 / Season 2 / …
pill row when a title has siblings; the admin new-title and edit forms
both get a "this is a season of" picker (a plain `<select>` of every
existing title — fine at this catalogue's scale, would need real
search if the list gets long).

**Duplicate check, now wired into `createTitleAction()`** in
`adminForms.ts`: runs `checkDuplicate()` on submission, skipped
entirely when `seasonOfId` is set (an intentional near-duplicate name
declaring itself as a season shouldn't trip the same check meant to
catch accidents). Deliberately **warn, not block**: a match doesn't
stop the save — the admin sees which existing title it resembles and
how closely, checks an explicit "I know — create it anyway" box, and
resubmits. Blocking outright was considered and rejected: a solo
curator who already knows a near-match is intentional (and isn't
using the season picker for some legitimate reason) shouldn't be
locked out of their own catalogue.

This needed a real behavior change to the create form, not just a
`checkDuplicate()` call: showing a dynamic warning and letting the
*same* form resubmit past it requires state to survive across
submissions, which a plain `FormData → void` action (every other
`*FromForm` function in `adminForms.ts`) has no way to carry. This is
what `useActionState` is for, and there was already exactly one
precedent for it in this codebase — `LoginForm.tsx` /
`loginAdminAction()`, which reports a login error back the same way.
`createTitleAction()` follows that shape, and the create form moved
into a new Client Component (`NewTitleForm.tsx`) to host the hook —
the same justified-exception reasoning as every other Client Component
in this app, not a drift away from "prefer plain
`<form action={serverAction}>`."

## Trope/mood tag picker (`TagPicker.tsx`)

The new-title and edit forms used to ask for trope/mood tags as a
plain comma-separated text field — meaning the admin had to remember
and retype the exact existing tag spelling every time to avoid
accidentally forking the taxonomy (`guilty_pleasure` vs
`guilty pleasure` vs `Guilty_Pleasure` becoming three different tags).
`TagPicker.tsx` shows every already-registered `TagDefinition` for
that category (trope reads marigold, mood reads rose — same
convention as the public `MoodChipBar.tsx`) as click-to-toggle chips,
with a plain text field underneath still open for anything genuinely
new. Both write into the same hidden `<input>`, in the same
comma-separated format the old plain field always submitted — so
`parseTitleFields()` / `normalizeAndRegisterTags()` in `actions.ts`
and `adminForms.ts` needed zero changes; as far as the backend's
concerned, nothing about the field changed at all.

## Cast + release date auto-fetch, trending thresholds, title text size

Three small, unrelated fixes from one audit pass.

**Trending had no minimum sample size.** Both `TrendingRail` and
`FandomTrendingRail` on the homepage previously had zero floor — a
single click-through or reaction was enough to label a title
"trending." Every other honesty-gated signal in this app has a real
threshold (`matching.ts`'s `MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL`,
`actions.ts`'s `MIN_VOTES_FOR_SKIP_METER_DISPLAY`) — this was a real
gap, not a deliberate exception. Both rails now use Prisma's `having`
clause on the `groupBy` to require 5+ interactions before a title
qualifies, same threshold used everywhere else for consistency.

**Cast + release date, JSON-LD only, no guessing fallback.**
`fetchTitleMetadata.ts` gained `castNames` (schema.org's `actor`
field) and `releaseDate` (`datePublished`), alongside the existing
episode-count extraction — refactored the JSON-LD parsing into one
shared `parseJsonLdEntries()` rather than three separate re-scans of
the same HTML. Deliberately **no text-pattern fallback** for either,
unlike episode count: regex-matching prose for names is genuinely
unreliable (false positives on any capitalized phrase), unlike
matching a number next to the word "episodes" — if a platform doesn't
publish structured data for these, the fields just stay blank for the
admin to fill in, never a guess dressed up as a fetch. `castNames` is
a simple `String[]` on `Title` (migration
`20260805120000_add_title_cast_names`), not a relational `CastMember`
model — faster to ship now; a real model (actor + optional character,
reusable across titles so "more from this actor" becomes possible
later) is the natural next step if cast data ends up mattering more
than expected, not built speculatively ahead of that. Both fields now
live in `TitleDetailsFetcher.tsx` — the deep-link section — rather
than as separate plain fields, same reasoning as episode count already
living there. `releaseDate` also got its first admin form field at
all in this pass; it existed in the schema with no way to actually set
it.

Cast shows on `/title/[id]` (a plain comma-separated line under the
synopsis) only when present — no separate "detail mode" or
click-to-expand interaction, the existing detail page already is
that.

**`TitleCard`'s name text sized down** one step at each breakpoint
(`text-base`/`lg:text-lg` → `text-sm`/`lg:text-base`) — purely a
visual density adjustment on the homepage/rail cards, not touched
anywhere else title text renders.

## Collections — curation as identity, not a forum

Kilig's earliest social feature was scoped as a discussion forum, then
deliberately un-scoped. A forum with three quiet threads reads as
failure — the whole point of a thread is other people replying — while
a profile with three good Collections reads as complete and useful on
day one, the same way a single good Letterboxd list or Spotify
playlist is worth something before anyone follows it. Curation
degrades gracefully at low density in a way discussion structurally
can't, and it's a better fit for a product that already thinks in
tags and match scores, not conversation. The hypothesis this MVP is
built to test: **people will follow other people because they
consistently curate great vertical dramas.** Everything else here is
secondary to that one measurement.

**Identity is deliberately the smallest thing that lets the
experiment run.** A `Curator` (`schema.prisma`) is a claimed display
name, nothing else — no password, no email, no profile fields. This
is a third, separate identity concept from the two that already
existed: the anonymous `sessionId` cookie (`session.ts`, powers
interaction logging) and the single-shared-password admin gate
(`admin.ts`, gates title-management mutations). None of those three
were touched or unified — a real accounts system is a real future
cost (see the "Not solved" list below), and building it speculatively
ahead of validating the curation hypothesis would be the same mistake
as building the forum. `curator.ts` mirrors `session.ts`'s
read-vs-write split (`peekCuratorId()` never writes a cookie, safe
in render bodies; the cookie is only ever set from
`claimDisplayName()` in `curator-actions.ts`).

**Collection is the primary object, not a post.** One curator, one
name, one question it answers ("CEOs Worth Falling For"). Adding a
title is one action: pick a Collection, write a note capped at 140
characters (`NOTE_MAX_LENGTH` in `curator-actions.ts`), done — see
`AddToCollectionWidget.tsx`. Re-adding a title already in the
Collection edits its note (an upsert on the
`[collectionId, titleId]` unique index) rather than erroring or
duplicating, since editing your own note is a legitimate thing to
want without a separate "edit" flow existing yet.

**Follow is unconditional; the follower *count* is what's gated.**
The `Follow` relationship is written from the first follow, always —
holding that back would mean holding back the only way to actually
measure the hypothesis. What's gated is what a stranger sees
rendered from it: `getFollowerDisplay()` returns the real number to
the curator viewing their own profile (truth matters, they're
building something) and returns `null` — rendered as "New curator" —
to anyone else until the count clears `MIN_FOLLOWERS_FOR_PUBLIC_DISPLAY`
(5, the same threshold value as `MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL`
in `matching.ts` and `MIN_VOTES_FOR_SKIP_METER_DISPLAY` in
`actions.ts` — a small number isn't a real signal anywhere else in
this app either, and a stat stamped "0" on a person's public identity
is a worse "nobody's here" signal than an empty forum thread ever
was). One-follow-per-pair is enforced by the database's
`[followerId, followingId]` unique index, not a check-then-insert —
`followCurator()` catches the resulting P2002 as "already following,"
same pattern as `logReaction()`'s uniqueness handling.

**Deliberately not built in this pass** (see the MVP scoping — these
are all real, known costs, not oversights): full accounts
(email/password/OAuth) — the claimed-name cookie is intentionally
disposable, losing it loses the identity, and that tradeoff should
get revisited once Collections prove out, not before; private or
collaborative Collections (one type only — public, single-curator);
comments or discussion on a Collection or its items (the note field
*is* the only text surface, on purpose); a curator directory,
trending-curators rail, or leaderboard (no social-proof-driven
discovery yet, same "don't manufacture activity" reasoning as
Trending's real threshold); moderation tooling beyond the 140-char
cap itself (a short note is a smaller, slower-velocity surface than
open comments, but it's still user-generated free text — this needs
real moderation before it scales past a trusted pilot group).

## Collections, round two — prominence, the claim gate, and likes

The first pass above under-shipped one thing: a Collection nobody can
find isn't testing the follow-driven-by-taste hypothesis, it's just a
private list. This pass makes curators and their Collections visible
by default and turns "open one" into the moment that asks for a
claimed name, rather than asking upfront before anyone has a reason
to want one.

**Visible without claiming, gated on open.** `CollectionsRail.tsx` (a
new rail on the homepage, positioned first — above Trending) and
`CuratedInSection.tsx` (a new section on every title page, showing
which curators' Collections include that title) both render curator
display names, Collection names, and — on the title page — the note
itself, to every visitor, no identity required. `/curators` is a
plain, unranked directory of every curator with at least one
non-empty Collection, same visibility rule. What's gated is only the
*destination*: `/collection/[id]` and `/curator/[displayName]` both
open with `if (!peekCuratorId()) redirect('/claim?next=...')` before
any other work happens on the page. `next` is round-tripped through
`ClaimIdentityForm.tsx` as a hidden field and validated by
`safeNextPath()` in `curator-actions.ts` (must be a same-origin
relative path — this is the one place in the feature handling
user-supplied redirect input, so it's checked like one) so claiming a
name lands you back on the exact Collection or profile you tried to
open, not a generic landing page.

This is a real product tradeoff, not a free upgrade: gating the
destination page (not just the follow/save actions within it) means a
casual visitor can't read a Collection's full contents without
claiming a name first. That's the explicit intent here — prominence
without a claimed-name payoff would just be a nicer-looking version of
the same discovery problem — but it trades away frictionless browsing
for a stronger identity funnel, and that tradeoff should get revisited
if it turns out to suppress curiosity clicks more than it converts
them.

**Likes are a second, lighter engagement surface**, added alongside
follow: `CollectionLike` (liking a whole Collection) and
`CollectionItemLike` (liking one curator's specific pick-plus-note
within a Collection) — see the models' comments in `schema.prisma`
for why they're tracked separately from each other and from the
pre-existing `TitleReaction` (which is anonymous and per-title, not
identity-attached or per-curation). Both require a claimed identity
to write, same as follow, but — unlike the follower count — a like
count is *never* threshold-gated: it's shown as its real number from
zero always. The reasoning `MIN_FOLLOWERS_FOR_PUBLIC_DISPLAY` is built
on is specifically about a stat stamped on a *person's* public
identity reading as "nobody's here" (see the original Collections
section above); a like count on a piece of content is a normal,
unremarkable stat in the same category as a play count, and doesn't
carry that cost at zero.

