-- CreateEnum
-- Skip Meter Stage 1: the curator's own honest read, formed from
-- watching 1-2 episodes, not a full watch-through. See
-- ARCHITECTURE.md's Skip Meter section.
CREATE TYPE "HookPoint" AS ENUM ('hooks_fast', 'slow_burn', 'filler_heavy');

CREATE TYPE "EndingType" AS ENUM ('happy', 'bittersweet', 'cliffhanger', 'unresolved');

-- AlterTable
ALTER TABLE "titles" ADD COLUMN "editorial_hook_point" "HookPoint";
ALTER TABLE "titles" ADD COLUMN "editorial_ending_type" "EndingType";
