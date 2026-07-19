import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function AdminLoginPage() {
  if (await isAdminSession()) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">Kilig</p>
      <h1 className="mb-6 font-[var(--font-display)] text-2xl font-semibold uppercase text-[var(--text)]">
        Admin
      </h1>
      <LoginForm />
    </main>
  );
}
