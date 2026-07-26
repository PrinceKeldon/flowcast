"use client";

import { useEffect } from "react";
import { logSearch } from "@/lib/actions";

/**
 * Same reasoning as ViewLogger.tsx — fires logSearch() from a real
 * client-triggered Server Action call instead of the page's render
 * body, where the cookie write inside getSessionId() isn't allowed.
 */
export function SearchLogger({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    logSearch(query, {}, resultCount);
  }, [query, resultCount]);

  return null;
}
