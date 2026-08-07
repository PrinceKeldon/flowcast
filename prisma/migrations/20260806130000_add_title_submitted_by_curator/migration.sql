-- AlterTable
-- Provenance for a title a Curator submitted via "Add a title not on
-- Kilig" (submitTitleFromLink() in curator-actions.ts). UUID, not
-- TEXT, to match curators.id's actual type (native uuid default) —
-- see the season_of_id migration fix for why this matters.
ALTER TABLE "titles" ADD COLUMN "submitted_by_curator_id" UUID;

-- CreateIndex
CREATE INDEX "titles_submitted_by_curator_id_idx" ON "titles" ("submitted_by_curator_id");

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_submitted_by_curator_id_fkey"
  FOREIGN KEY ("submitted_by_curator_id") REFERENCES "curators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
