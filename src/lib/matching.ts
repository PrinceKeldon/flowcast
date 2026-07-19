import { prisma } from "@/lib/prisma";
import type { Title } from "@/generated/prisma";

/**
 * V1 "honest match score."
 *
 * This is NOT personalized to any user — it's a weighted tag-overlap
 * similarity between a reference title and a candidate:
 *
 *   score = 0.6 * jaccard(tropeTags) + 0.3 * jaccard(moodTags) + 0.1 * pacingMatch
 *
 * Always pair this score in the UI with what it's measuring
 * ("N% match with <reference title>"), never as a bare percentage —
 * that's what keeps it honest instead of implying personalization the
 * product doesn't have yet. Once real interaction-behavior data exists
 * (see UserInteraction), blend a behavioral similarity term in here
 * before calling it a "your match" score. See ARCHITECTURE.md.
 */

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const item of setB) {
    if (setA.has(item)) intersection++;
  }
  return intersection / union.size;
}

export interface MatchedOn {
  sharedTropes: string[];
  sharedMoods: string[];
  samePacing: boolean;
}

export function computeMatchScore(
  reference: Pick<Title, "tropeTags" | "moodTags" | "pacing">,
  candidate: Pick<Title, "tropeTags" | "moodTags" | "pacing">
): { score: number; matchedOn: MatchedOn } {
  const tropeOverlap = reference.tropeTags.filter((t: string) => candidate.tropeTags.includes(t));
  const moodOverlap = reference.moodTags.filter((m: string) => candidate.moodTags.includes(m));
  const samePacing = Boolean(reference.pacing && reference.pacing === candidate.pacing);

  const score =
    0.6 * jaccard(reference.tropeTags, candidate.tropeTags) +
    0.3 * jaccard(reference.moodTags, candidate.moodTags) +
    0.1 * (samePacing ? 1 : 0);

  return {
    score: Math.round(score * 100),
    matchedOn: {
      sharedTropes: tropeOverlap,
      sharedMoods: moodOverlap,
      samePacing,
    },
  };
}

export async function getSimilarTitles(titleId: string, limit = 6) {
  const reference = await prisma.title.findUnique({ where: { id: titleId } });
  if (!reference) return [];

  const candidates: Title[] = await prisma.title.findMany({
    where: { id: { not: titleId }, isPublished: true },
  });

  const scored = candidates
    .map((candidate: Title) => {
      const { score, matchedOn } = computeMatchScore(reference, candidate);
      return { title: candidate, matchScore: score, matchedOn };
    })
    .filter((s: { matchScore: number }) => s.matchScore > 0) // don't surface titles with zero genuine overlap
    .sort((a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
}
