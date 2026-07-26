"use client";

import { useEffect } from "react";
import { logInteraction } from "@/lib/actions";

/**
 * Renders nothing — exists only to fire logInteraction() from a real
 * client-triggered Server Action call, not from the page's render body.
 * Next.js only allows cookie mutation (which getSessionId() does, on
 * first visit) inside a Server Action invocation or Route Handler;
 * calling a "use server" function directly during a Server Component's
 * render is a plain function call as far as that restriction is
 * concerned, not a genuine action invocation. See lib/session.ts.
 */
export function ViewLogger({ titleId }: { titleId: string }) {
  useEffect(() => {
    logInteraction({ titleId, action: "viewed_detail" });
  }, [titleId]);

  return null;
}
