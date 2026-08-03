-- CreateIndex
-- Enforces "one reaction per session per title" at the database level
-- (not just client-side UX) — see the comment above `UserInteraction`
-- in schema.prisma for why this is a *partial* index scoped to
-- WHERE action = 'reacted' rather than a blanket @@unique across the
-- whole table: sessions legitimately have multiple viewed_detail /
-- clicked_out rows for the same title, and this must not constrain
-- those.
--
-- Must run as its own migration, after 'reacted' has committed as an
-- enum value in the previous migration
-- (20260802120000_add_reacted_interaction_action) — see that file's
-- comment for why the two can't be combined.
CREATE UNIQUE INDEX "user_interactions_reacted_session_title_unique"
  ON "user_interactions" ("session_id", "title_id")
  WHERE "action" = 'reacted';
