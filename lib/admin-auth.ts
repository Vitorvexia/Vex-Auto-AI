import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email);
}

export async function assertSuperAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  if (!isSuperAdmin(user.email)) {
    redirect("/leads");
  }

  return user.id;
}
