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
