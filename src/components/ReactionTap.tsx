"use client";

import { useState, useTransition } from "react";
import { logReaction, getReactedEmoji } from "@/lib/actions";

// Matches the examples named when this feature was scoped (❤️ 🔥 😭)
// plus two similarly common short-video-app reaction emojis. This
// build environment has no live database access, so the actual set
// entered via /admin so far couldn't be checked directly — worth
// confirming against real TitleReaction data and adjusting this list
// if it diverges.
const REACTION_EMOJIS = ["❤️", "🔥", "😭", "😂", "😍"];

interface ReactionTapProps {
  titleId: string;
  /**
   * The emoji this session already reacted with, if any — computed
   * server-side in title/[id]/page.tsx via a read-only session peek,
   * so a returning visitor sees their own past reaction pre-disabled
   * on load rather than only finding out after tapping again.
   */
  initialReactedEmoji: string | null;
}

export function ReactionTap({ titleId, initialReactedEmoji }: ReactionTapProps) {
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(initialReactedEmoji);
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasReacted = reactedEmoji !== null;

  function handleTap(emoji: string) {
    if (hasReacted || isPending) return;

    setPendingEmoji(emoji);
    startTransition(async () => {
      const result = await logReaction(titleId, emoji);

      if (result.ok) {
        setReactedEmoji(emoji);
      } else if (result.alreadyReacted) {
        // The real server-side uniqueness constraint (partial unique
        // index — see schema.prisma) is what actually prevents
        // double-reacting; this branch is the rare case where it
        // fired (e.g. two tabs open) even though the client thought
        // no reaction existed yet. Don't assume the just-tapped emoji
        // is the one that won — look up what's actually stored so the
        // UI reflects reality, not a guess.
        const actual = await getReactedEmoji(titleId);
        setReactedEmoji(actual ?? emoji);
      }
      // A genuine failure (result.ok === false, alreadyReacted === false)
      // just leaves the row untouched and tappable again — same
      // fire-and-forget tolerance as the rest of this app's logging.

      setPendingEmoji(null);
    });
  }

  return (
    <div className="mb-5 flex items-center gap-2">
      {REACTION_EMOJIS.map((emoji) => {
        const isThisOne = reactedEmoji === emoji;
        const isThisPending = pendingEmoji === emoji && isPending;

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleTap(emoji)}
            disabled={hasReacted || isPending}
            aria-pressed={isThisOne}
            aria-label={`React with ${emoji}`}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition-all ${
              isThisOne
                ? "scale-110 border-[var(--accent-marigold)] bg-[var(--accent-marigold)]/10"
                : "border-[var(--border)] bg-[var(--surface)]"
            } ${hasReacted && !isThisOne ? "opacity-40" : ""} ${
              !hasReacted && !isPending ? "hover:border-[var(--accent-marigold)]" : ""
            } ${isThisPending ? "animate-pulse" : ""}`}
          >
            {emoji}
          </button>
        );
      })}
      {hasReacted && (
        <span className="ml-1 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
          You reacted
        </span>
      )}
    </div>
  );
}
