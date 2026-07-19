import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "kilig_admin";

/**
 * Lightweight, single-shared-password admin gate — deliberately not a
 * full accounts system. This is the right size for one person curating
 * titles solo (see ARCHITECTURE.md roadmap); revisit with real accounts
 * once more than one person needs to touch the admin mutations.
 *
 * The cookie never holds the raw password — it holds sha256(password),
 * so a leaked cookie value doesn't hand over the actual credential.
 * It's httpOnly regardless, but this is cheap defense in depth.
 */

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sessionToken(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function isAdminSession(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false; // no password configured = admin stays fully closed

  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!value) return false;

  return timingSafeStringEqual(value, sessionToken(password));
}

/**
 * Guard for the admin Server Actions in actions.ts (createTitle,
 * addAvailability, addReaction). Throws rather than redirecting —
 * these are called from form actions / programmatically, not rendered
 * as a page, so a thrown error is what the caller can actually handle.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSession())) {
    throw new Error("Not authorized — log in at /admin/login first.");
  }
}

export interface LoginFormState {
  error?: string;
}

export async function loginAdminAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  "use server";

  const password = process.env.ADMIN_PASSWORD;
  const supplied = String(formData.get("password") ?? "");

  if (!password) {
    return { error: "ADMIN_PASSWORD isn't set on the server yet." };
  }
  if (!supplied || !timingSafeStringEqual(supplied, password)) {
    return { error: "Wrong password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  redirect("/admin");
}

export async function logoutAdminAction(): Promise<void> {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
