"use client";

import { ExternalLink } from "lucide-react";
import { logWatchClick } from "@/lib/actions";
import type { Availability } from "@/generated/prisma/client";

export function WatchButton({ availability, titleId }: { availability: Availability; titleId: string }) {
  const handleClick = () => {
    // Fire-and-forget: don't block the outbound navigation on the log call.
    logWatchClick(titleId, availability.id, availability.platform);
    window.open(availability.deepLinkUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="mb-2 flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent-marigold)]"
    >
      <span className="font-semibold">{availability.platform}</span>
      <span className="flex items-center gap-2 font-mono text-xs text-[var(--accent-marigold)]">
        {availability.priceModel === "free" ? "Free" : availability.priceModel.replace(/_/g, " ")}
        <ExternalLink size={14} aria-hidden="true" />
      </span>
    </button>
  );
}
