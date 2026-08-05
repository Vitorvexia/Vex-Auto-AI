/**
 * Leitura pública de estoque por subdomínio — roadmap 1.3.
 *
 * Roda contra Supabase real (pula se faltarem credenciais reais, mesmo
 * padrão de realtime-isolation.test.ts). Valida o que só o banco real prova:
 *   - view public_store_lookup resolve slug -> store_id via anon key
 *   - view public_vehicle_listings isola loja A de loja B
 *   - custo/margem_minima NUNCA aparecem no payload, mesmo com select("*")
 *   - disponivel=false nunca aparece na view pública
 *   - SELECT direto em `vehicles`/`stores` via anon continua bloqueado —
 *     comportamento pré-existente, não alterado por esta feature
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { db, hasSupabase, deleteStoreDeep } from "./helpers";
import {
  resolveStoreIdBySlug,
  getPublicVehicleListings,
} from "@/lib/public-store";

const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const canRunAsAnon = hasSupabase && !!anonUrl && !!anonKey;

const describeIf = canRunAsAnon ? describe : describe.skip;

const TEST_PREFIX = "__test__public-vehicle-listings";

async function createTestStoreWithSlug(label: string): Promise<{ id: string; slug: string }> {
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const whatsapp_numero = `+9${Date.now().toString().slice(-8)}${rand}`.slice(0, 15);
  const slug = `test-pvl-${label.toLowerCase()}-${randomUUID()}`.slice(0, 60);
  const { data, error } = await db
    .from("stores")
    .insert({ nome: `${TEST_PREFIX}-${label}`, whatsapp_numero, slug })
    .select("id, slug")
    .single();
  if (error) throw error;
  return { id: data.id as string, slug: data.slug as string };
}

async function createVehicle(
  storeId: string,
  overrides: Partial<{ disponivel: boolean; publicado: boolean }> = {}
): Promise<string> {
  const { data, error } = await db
    .from("vehicles")
    .insert({
      store_id: storeId,
      marca: "Honda",
      modelo: "CG 160",
      ano: 2022,
      preco: 15000,
      custo: 10000,
      margem_minima: 1000,
      disponivel: true,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describeIf("Leitura pública de estoque — public_vehicle_listings / public_store_lookup (roadmap 1.3)", () => {
  let storeA: { id: string; slug: string };
  let storeB: { id: string; slug: string };
  let anonClient: SupabaseClient;

  beforeAll(async () => {
    storeA = await createTestStoreWithSlug("A");
    storeB = await createTestStoreWithSlug("B");
    anonClient = createClient(anonUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }, 30000);

  afterAll(async () => {
    if (storeA?.id) await deleteStoreDeep(storeA.id);
    if (storeB?.id) await deleteStoreDeep(storeB.id);
  });

  it("PVL-1: resolveStoreIdBySlug via anon resolve o slug certo para o store_id certo", async () => {
    const resolved = await resolveStoreIdBySlug(anonClient, storeA.slug);
    expect(resolved).toBe(storeA.id);
  });

  it("PVL-2: slug inexistente resolve null via anon (não lança)", async () => {
    const resolved = await resolveStoreIdBySlug(
      anonClient,
      `slug-inexistente-${randomUUID()}`
    );
    expect(resolved).toBeNull();
  });

  it("PVL-3: isolamento — veículo da loja B nunca aparece consultando por storeA.id, e vice-versa", async () => {
    const vehicleA = await createVehicle(storeA.id);
    const vehicleB = await createVehicle(storeB.id);

    const listA = await getPublicVehicleListings(anonClient, storeA.id);
    const listB = await getPublicVehicleListings(anonClient, storeB.id);

    expect(listA.map((v) => v.id)).toContain(vehicleA);
    expect(listA.map((v) => v.id)).not.toContain(vehicleB);
    expect(listB.map((v) => v.id)).toContain(vehicleB);
    expect(listB.map((v) => v.id)).not.toContain(vehicleA);
    for (const v of listA) expect(v.store_id).toBe(storeA.id);
    for (const v of listB) expect(v.store_id).toBe(storeB.id);
  });

  it("PVL-4: a view NUNCA expõe custo/margem_minima — nem pedindo select('*') direto via anon", async () => {
    await createVehicle(storeA.id);
    const { data, error } = await anonClient
      .from("public_vehicle_listings")
      .select("*")
      .eq("store_id", storeA.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(Object.keys(row)).not.toContain("custo");
      expect(Object.keys(row)).not.toContain("margem_minima");
    }
  });

  it("PVL-5: veículo indisponível (disponivel=false) nunca aparece na view pública", async () => {
    const hiddenId = await createVehicle(storeA.id, { disponivel: false });
    const list = await getPublicVehicleListings(anonClient, storeA.id);
    expect(list.map((v) => v.id)).not.toContain(hiddenId);
  });

  it("PVL-5b (roadmap 1.4): veículo publicado=false nunca aparece na view pública, mesmo com disponivel=true", async () => {
    const hiddenId = await createVehicle(storeA.id, { disponivel: true, publicado: false });
    const list = await getPublicVehicleListings(anonClient, storeA.id);
    expect(list.map((v) => v.id)).not.toContain(hiddenId);
  });

  it("PVL-6: SELECT direto em vehicles via anon continua bloqueado — comportamento pré-existente, não alterado", async () => {
    const { data, error } = await anonClient
      .from("vehicles")
      .select("*")
      .eq("store_id", storeA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("PVL-7: SELECT direto em stores via anon continua bloqueado — resolução pública passa só pela view", async () => {
    const { data, error } = await anonClient
      .from("stores")
      .select("*")
      .eq("id", storeA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("PVL-8: public_store_lookup expõe só a allowlist pós-1.5 (nunca whatsapp_numero/whatsapp_phone_number_id), mesmo com select('*')", async () => {
    const { data, error } = await anonClient
      .from("public_store_lookup")
      .select("*")
      .eq("id", storeA.id);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    // Allowlist real da view (migration 039, roadmap 1.5) — nome/logo/cor/
    // telefone/endereço/sobre são públicos de propósito (site da loja precisa
    // exibir identidade visual). PVL-8 testava a allowlist da migration 035
    // (só id/slug), desatualizada desde a 039 — BL-0027.
    expect(Object.keys(data![0]).sort()).toEqual(
      ["id", "slug", "nome", "logo_url", "cor_primaria", "telefone_publico", "endereco", "sobre"].sort()
    );
    expect(Object.keys(data![0])).not.toContain("whatsapp_numero");
    expect(Object.keys(data![0])).not.toContain("whatsapp_phone_number_id");
  });
});
