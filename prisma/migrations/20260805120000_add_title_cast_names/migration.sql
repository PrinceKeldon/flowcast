-- AlterTable
-- Simple list of actor names, deliberately not a relational CastMember
-- model for now — see ARCHITECTURE.md's Cast section. Same TEXT[]
-- convention as trope_tags/mood_tags in the init migration (no
-- NOT NULL / DEFAULT — the app always writes an array, even empty,
-- on create).
ALTER TABLE "titles" ADD COLUMN "cast_names" TEXT[];
