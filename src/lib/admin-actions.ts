"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "kilig_admin";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sessionToken(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export interface LoginFormState {
  error?: string;
}

export async function loginAdminAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const password = process.env.ADMIN_PASSWORD;
  const supplied = String(formData.get("password") ?? "");

  if (!password) {
    return { error: "ADMIN_PASSWORD isn't set on the server yet." };
  }
  if (!supplied || !timingSafeStringEqual(supplied, password)) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    return { error: "Wrong password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/admin");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
