/**
 * Discovery Engine — duplicate detection.
 *
 * Vertical drama titles get re-licensed, re-dubbed, and re-listed
 * under slightly different names across platforms constantly
 * ("Crowned in Love: The Mother of Three Big Shots" vs "Crowned In
 * Love (Dubbed)"), so exact-string matching would let obvious
 * duplicates through. This uses Sørensen–Dice bigram similarity on a
 * normalized name — cheap, dependency-free, and good enough to flag
 * near-matches for a human to confirm. It is explicitly NOT a
 * confidence score for auto-merging; see DuplicatePolicy in types.ts
 * — "review" is the safe default for a reason.
 *
 * Two callers: the Discovery Engine's mission runner (mission.ts),
 * and — despite living under lib/discovery/ — createTitleAction() in
 * lib/adminForms.ts, the actual primary title-creation path now that
 * automated platform crawling was walked back to manual entry. It was
 * only ever wired into the former for a while, which meant the path
 * almost everything goes through had no duplicate protection at all.
 * Not moved out of lib/discovery/ since nothing here is
 * Discovery-Engine-specific and a move risked breaking the existing
 * caller for no real benefit.
 *
 * At catalogue sizes in the low thousands, comparing against every
 * existing title per import is fine. If this ever needs to scale
 * past that, swap the findMany() below for a Postgres pg_trgm
 * similarity query instead of rewriting the comparison logic.
 */

import { prisma } from "@/lib/prisma";
import type { DuplicateResult } from "./types";

const DUPLICATE_THRESHOLD = 0.82;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\(dubbed\)|\(sub\)|\(uncut\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(s: string): Set<string> {
  const padded = ` ${s} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 1; i++) {
    grams.add(padded.slice(i, i + 2));
  }
  return grams;
}

/** Sørensen–Dice coefficient over character bigrams. 1.0 = identical, 0.0 = nothing shared. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ga = bigrams(na);
  const gb = bigrams(nb);
  if (ga.size === 0 || gb.size === 0) return 0;

  let overlap = 0;
  for (const gram of ga) {
    if (gb.has(gram)) overlap++;
  }
  return (2 * overlap) / (ga.size + gb.size);
}

/**
 * Checks a candidate title name against every existing Title, returns
 * the closest match. Callers decide what to do with the result —
 * this function never touches the database beyond reading.
 */
export async function checkDuplicate(candidateName: string): Promise<DuplicateResult> {
  if (!candidateName?.trim()) {
    return { isDuplicate: false, score: 0, reason: "No candidate name to compare." };
  }

  const existing = await prisma.title.findMany({
    select: { id: true, name: true },
  });

  let best: { id: string; name: string; score: number } | undefined;
  for (const title of existing) {
    const score = nameSimilarity(candidateName, title.name);
    if (!best || score > best.score) {
      best = { id: title.id, name: title.name, score };
    }
  }

  if (!best || best.score < DUPLICATE_THRESHOLD) {
    return { isDuplicate: false, score: best?.score ?? 0 };
  }

  return {
    isDuplicate: true,
    score: best.score,
    existingTitleId: best.id,
    existingTitleName: best.name,
    reason: `Name is ${(best.score * 100).toFixed(0)}% similar to existing title "${best.name}".`,
  };
}
