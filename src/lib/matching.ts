import { prisma } from "@/lib/prisma";
import type { Title, InteractionAction } from "@/generated/prisma/client";

/**
 * "Honest match score" — v2, now with a behavioral term blended in.
 *
 * The base is a weighted tag-overlap similarity between a reference
 * title and a candidate:
 *
 *   tagScore = 0.6 * jaccard(tropeTags) + 0.3 * jaccard(moodTags) + 0.1 * pacingMatch
 *
 * Once the reference title has enough qualifying UserInteraction volume
 * (see MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL below), a session-co-occurrence
 * term is blended in: candidates get a boost if the same browsing
 * sessions engaged with both the reference and the candidate. Below that
 * threshold it falls back to tagScore alone — a handful of sessions
 * would swing the score wildly, which isn't an honest signal yet.
 *
 * This is still NOT personalized to the *viewing* user — it's title-to-
 * title similarity, informed by how sessions in general have engaged
 * with the reference title. Always pair the score in the UI with what
 * it's measuring ("N% match with <reference title>"), never as a bare
 * percentage. See ARCHITECTURE.md.
 */

const MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL = 5;
const BEHAVIORAL_WEIGHT = 0.5;
const BEHAVIORAL_QUALIFYING_ACTIONS: InteractionAction[] = ["viewed_detail", "clicked_out", "saved"];

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

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of b) {
    if (a.has(item)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
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

/**
 * Session-co-occurrence behavioral signal for a reference title against
 * a set of candidates. Returns null (behavioral term disabled) if the
 * reference title doesn't yet have enough qualifying sessions.
 */
async function getBehavioralOverlap(
  referenceId: string,
  candidateIds: string[]
): Promise<Map<string, number> | null> {
  if (candidateIds.length === 0) return null;

  const interactions = await prisma.userInteraction.findMany({
    where: {
      titleId: { in: [referenceId, ...candidateIds] },
      action: { in: BEHAVIORAL_QUALIFYING_ACTIONS },
    },
    select: { titleId: true, sessionId: true },
  });

  const sessionsByTitle = new Map<string, Set<string>>();
  for (const i of interactions) {
    const set = sessionsByTitle.get(i.titleId) ?? new Set<string>();
    set.add(i.sessionId);
    sessionsByTitle.set(i.titleId, set);
  }

  const referenceSessions = sessionsByTitle.get(referenceId) ?? new Set<string>();
  if (referenceSessions.size < MIN_SESSIONS_FOR_BEHAVIORAL_SIGNAL) return null;

  const scores = new Map<string, number>();
  for (const candidateId of candidateIds) {
    const candidateSessions = sessionsByTitle.get(candidateId) ?? new Set<string>();
    scores.set(candidateId, jaccardSets(referenceSessions, candidateSessions));
  }
  return scores;
}

export async function getSimilarTitles(titleId: string, limit = 6) {
  const reference = await prisma.title.findUnique({ where: { id: titleId } });
  if (!reference) return [];

  const candidates: Title[] = await prisma.title.findMany({
    where: { id: { not: titleId }, isPublished: true },
  });

  const behavioral = await getBehavioralOverlap(
    titleId,
    candidates.map((c) => c.id)
  );

  const scored = candidates
    .map((candidate: Title) => {
      const { score: tagScore, matchedOn } = computeMatchScore(reference, candidate);
      const behavioralScore = behavioral?.get(candidate.id);

      const tagFraction = tagScore / 100;
      const blendedFraction =
        behavioralScore !== undefined
          ? (1 - BEHAVIORAL_WEIGHT) * tagFraction + BEHAVIORAL_WEIGHT * behavioralScore
          : tagFraction;

      return {
        title: candidate,
        matchScore: Math.round(blendedFraction * 100),
        matchedOn,
        behavioralSignal: behavioralScore !== undefined,
      };
    })
    .filter((s: { matchScore: number }) => s.matchScore > 0) // don't surface titles with zero genuine overlap
    .sort((a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
}
