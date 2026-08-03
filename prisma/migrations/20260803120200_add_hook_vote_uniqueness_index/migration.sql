-- CreateIndex
-- Enforces "one hook-vote per session per title" at the database
-- level — see the comment above `UserInteraction` in schema.prisma.
-- Partial (WHERE-scoped) for the same reason as the 'reacted' index:
-- sessions legitimately have multiple rows of other actions for the
-- same title, and this must not constrain those.
--
-- Must run as its own migration, after 'hook_vote' has committed as
-- an enum value in the previous migration
-- (20260803120100_add_hook_vote_interaction_action).
CREATE UNIQUE INDEX "user_interactions_hook_vote_session_title_unique"
  ON "user_interactions" ("session_id", "title_id")
  WHERE "action" = 'hook_vote';
