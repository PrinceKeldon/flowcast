import { cookies } from "next/headers";

const CURATOR_COOKIE = "kilig_curator_id";

/**
 * Curator identity is deliberately lightweight — a claimed display
 * name, not a full accounts system (see schema.prisma's comment on
 * Curator, and ARCHITECTURE.md's Collections section for why). This
 * cookie just remembers *which* Curator row a browser has claimed,
 * the same shape as session.ts's anonymous session cookie but for a
 * different purpose: session.ts identifies a browsing session for
 * interaction logging, this identifies a claimed public identity for
 * publishing Collections and following other curators. A browser can
 * have both, or the curator cookie alone can be absent — most
 * visitors never claim a name at all.
 *
 * Unlike getSessionId(), this never creates a Curator as a side
 * effect of being called — a Curator only comes into existence via
 * claimDisplayName() (lib/curator-actions.ts) when someone explicitly
 * picks a name. This function only ever reads or clears the cookie.
 *
 * Next.js only allows cookie mutation inside a Server Action or Route
 * Handler — see setCuratorCookie() below, called from
 * claimDisplayName() after the Curator row is created.
 */
export async function peekCuratorId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CURATOR_COOKIE)?.value ?? null;
}

/**
 * Sets the curator cookie once a Curator row exists. Only call from
 * within a 'use server' function (claimDisplayName), same restriction
 * as getSessionId() in session.ts.
 */
export async function setCuratorCookie(curatorId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CURATOR_COOKIE, curatorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}
