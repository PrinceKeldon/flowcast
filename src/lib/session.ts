import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const SESSION_COOKIE = "kilig_session_id";

/**
 * Gets or creates an anonymous session id, persisted via cookie.
 * This is what stitches together a single browsing session's behavior
 * in UserInteraction — swap in a real user id once accounts exist,
 * but keep sessionId either way.
 *
 * IMPORTANT: Next.js only allows cookie mutation inside a Server Action
 * or Route Handler, not during a Server Component render. Only call this
 * from within actions.ts (or another 'use server' function) — not from
 * page.tsx / layout.tsx render bodies directly.
 */
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return id;
}

/**
 * Read-only session lookup — returns the existing session id if the
 * cookie is already set, or null if this visitor has none yet. Unlike
 * getSessionId(), this never writes a cookie, so it's safe to call
 * from a Server Component's render body (only cookie *mutation* is
 * restricted to Server Actions/Route Handlers — reading is always
 * fine). Used where a page needs to check "has this session already
 * done X" without creating a session as a side effect of looking —
 * e.g. title/[id]/page.tsx checking whether the current visitor has
 * already reacted, to pre-disable ReactionTap on load instead of only
 * discovering that after a rejected tap.
 */
export async function peekSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}
