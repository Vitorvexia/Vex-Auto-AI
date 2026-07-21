import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";

export class AuthError extends Error {
  constructor(message = "unauthenticated") {
    super(message);
    this.name = "AuthError";
  }
}

export class StoreNotFoundError extends Error {
  constructor(userId: string) {
    super(`store not found for user: ${userId}`);
    this.name = "StoreNotFoundError";
  }
}

export async function getServerStoreId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError();
  const { data } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", user.id)
    .single();
  if (!data?.store_id) throw new StoreNotFoundError(user.id);
  return data.store_id as string;
}

export async function getServerUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError();
  return user.id;
}

export type UserRole = "super_admin" | "dono_loja" | "vendedor";

export async function getServerUserRole(): Promise<UserRole> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError();

  if (isSuperAdmin(user.email)) return "super_admin";

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!data?.role) throw new StoreNotFoundError(user.id);

  return data.role as UserRole;
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function assertStoreAdmin(): Promise<string> {
  const role = await getServerUserRole();
  if (role !== "dono_loja") throw new ForbiddenError();
  return getServerStoreId();
}
