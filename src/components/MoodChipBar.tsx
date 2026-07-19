"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Flame, Sparkles, HeartCrack, Eye, Crown, Lock, Drama } from "lucide-react";
import { MOOD_CHIPS, type MoodChip } from "@/lib/moodChips";

const ICONS: Record<MoodChip["icon"], typeof Heart> = {
  Heart,
  Flame,
  Sparkles,
  HeartCrack,
  Eye,
  Crown,
  Lock,
  Drama,
};

/**
 * Mood selection lives in the URL (?mood=longing,revenge) rather than
 * client component state. This keeps the browse experience server-
 * rendered and shareable — toggling a chip is a navigation, not a
 * client-side fetch — while still feeling instant via Next.js's
 * client-side router cache.
 */
export function MoodChipBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeMoods = searchParams.get("mood")?.split(",").filter(Boolean) ?? [];

  const toggleMood = (value: string) => {
    const next = activeMoods.includes(value)
      ? activeMoods.filter((v) => v !== value)
      : [...activeMoods, value];

    const params = new URLSearchParams(searchParams.toString());
    if (next.length) {
      params.set("mood", next.join(","));
    } else {
      params.delete("mood");
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {MOOD_CHIPS.map((chip) => {
        const Icon = ICONS[chip.icon];
        const isActive = activeMoods.includes(chip.value);
        return (
          <button
            key={chip.value}
            onClick={() => toggleMood(chip.value)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors
              ${isActive
                ? "bg-[var(--accent-rose)] border-[var(--accent-rose)] text-[var(--bg)]"
                : "bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent-rose)]"
              }`}
          >
            <Icon size={16} aria-hidden="true" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
