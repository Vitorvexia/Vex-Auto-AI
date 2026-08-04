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
export interface PublicStoreInfo {
  id: string;
  slug: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string | null;
  telefone_publico: string | null;
  endereco: string | null;
  sobre: string | null;
}

/**
 * Busca dados públicos de identidade da loja por slug (roadmap 1.5) — nome,
 * logo, cor primária, telefone, endereço, sobre. Mesma VIEW de
 * resolveStoreIdBySlug (migration 039 estendeu a allowlist), nunca `stores`
 * direto — allowlist explícita, nunca whatsapp_numero/whatsapp_phone_number_id
 * ou qualquer credencial.
 */
export async function getPublicStoreBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<PublicStoreInfo | null> {
  const { data, error } = await supabase
    .from("public_store_lookup")
    .select("id, slug, nome, logo_url, cor_primaria, telefone_publico, endereco, sobre")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicStoreInfo | null) ?? null;
}

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

/**
 * Busca 1 veículo público por id (página de detalhe, roadmap 1.4) — mesma
 * VIEW e mesma allowlist de getPublicVehicleListings, nunca `vehicles`
 * direto. Filtro duplo (store_id + id) evita que o id de um veículo de outra
 * loja resolva por engano via URL adivinhada.
 */
export async function getPublicVehicleById(
  supabase: SupabaseClient,
  storeId: string,
  vehicleId: string
): Promise<PublicVehicleListing | null> {
  const { data, error } = await supabase
    .from("public_vehicle_listings")
    .select("id, store_id, marca, modelo, ano, preco, photo_url, disponivel")
    .eq("store_id", storeId)
    .eq("id", vehicleId)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicVehicleListing | null) ?? null;
}
