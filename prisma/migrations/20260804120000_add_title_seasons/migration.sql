-- AlterTable
-- Links Season 2+ of a show back to Season 1 (or any other title
-- treated as the "root") as its own independent Title row — see the
-- comment on Title.seasonOfId in schema.prisma for why this is a link
-- between rows rather than one row with a bumped episode count.
ALTER TABLE "titles" ADD COLUMN "season_of_id" UUID;
ALTER TABLE "titles" ADD COLUMN "season_number" INTEGER;

-- CreateIndex
-- Matches what `prisma migrate dev` would generate automatically for
-- a relation scalar field — this migration is hand-assembled (no live
-- DB connection in the build environment used so far), so this is
-- added explicitly rather than relying on that default.
CREATE INDEX "titles_season_of_id_idx" ON "titles" ("season_of_id");

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_season_of_id_fkey"
  FOREIGN KEY ("season_of_id") REFERENCES "titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
