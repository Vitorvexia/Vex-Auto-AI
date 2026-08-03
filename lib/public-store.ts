import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicVehicleListing {
  id: string;
  store_id: string;
  marca: string;
  modelo: string;
  ano: number;
  preco: number;
  photo_url: string[];
  disponivel: boolean;
}

/**
 * Resolve store_id a partir do slug amigável de URL. null se não existir.
 * Consulta a VIEW public_store_lookup (migration 035), nunca `stores`
 * direto — `stores` não tem policy de RLS para o role anon (migration 005
 * só libera authenticated via my_store_id()), então SELECT direto retornaria
 * sempre 0 linhas para a rota pública.
 */
export async function resolveStoreIdBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("public_store_lookup")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/**
 * Lista veículos públicos de uma loja via a VIEW public_vehicle_listings
 * (migration 034) — nunca consulta `vehicles` direto. Allowlist de colunas
 * espelha exatamente a view; custo/margem_minima não existem na origem, não
 * precisam ser filtrados aqui.
 */
export async function getPublicVehicleListings(
  supabase: SupabaseClient,
  storeId: string
): Promise<PublicVehicleListing[]> {
  const { data, error } = await supabase
    .from("public_vehicle_listings")
    .select("id, store_id, marca, modelo, ano, preco, photo_url, disponivel")
    .eq("store_id", storeId)
    .order("preco", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PublicVehicleListing[];
}
