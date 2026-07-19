// Emotion-first entry points. Each chip maps a human feeling to the
// underlying taxonomy value that actually powers the filter — the
// taxonomy stays real and queryable, but the user never has to speak
// its language. See ARCHITECTURE.md for the product reasoning.
export type ChipTagType = "trope" | "mood";

export interface MoodChip {
  icon: "Heart" | "Flame" | "Sparkles" | "HeartCrack" | "Eye" | "Crown" | "Lock" | "Drama";
  label: string;
  type: ChipTagType;
  value: string;
}

export const MOOD_CHIPS: MoodChip[] = [
  { icon: "Heart", label: "Longing", type: "mood", value: "longing" },
  { icon: "Flame", label: "Revenge", type: "trope", value: "revenge" },
  { icon: "Sparkles", label: "Butterflies", type: "mood", value: "butterflies" },
  { icon: "HeartCrack", label: "Heartbreak", type: "mood", value: "heartbreak" },
  { icon: "Eye", label: "Guilty Pleasure", type: "mood", value: "guilty_pleasure" },
  { icon: "Crown", label: "Billionaire Drama", type: "trope", value: "billionaire" },
  { icon: "Lock", label: "Fake Marriage", type: "trope", value: "fake_marriage" },
  { icon: "Drama", label: "Secret Identity", type: "trope", value: "secret_identity" },
];

// Shown before the user picks anything — a reasonable front page
// rather than an empty state.
export const DEFAULT_MOODS = MOOD_CHIPS.slice(0, 3);

export function findChip(value: string): MoodChip | undefined {
  return MOOD_CHIPS.find((c) => c.value === value);
}
