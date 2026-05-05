import { createSupabaseServerClient } from "@/lib/supabase-server";

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
