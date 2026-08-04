/**
 * lib/public-store.ts — leitura pública de estoque por slug (roadmap 1.3).
 *
 * Nível: unit (mock-based), mesmo padrão de rls-isolation.test.ts e
 * agent-context. Valida o CONTRATO da camada de aplicação: qual tabela é
 * consultada, quais colunas são pedidas, e que o filtro de store_id é sempre
 * aplicado. Validação real do isolamento entre lojas e da ausência de
 * custo/margem_minima na origem do dado (a view em si) é integration
 * (tests/integration/public-vehicle-listings.test.ts, roda contra Supabase real).
 */
import { describe, it, expect, vi } from "vitest";
import {
  resolveStoreIdBySlug,
  getPublicVehicleListings,
  getPublicVehicleById,
  getPublicStoreBySlug,
} from "@/lib/public-store";

function buildChain(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "order"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  // order() é o último elo antes do await na listagem — resolve a promise ali.
  chain.order = vi.fn().mockResolvedValue(finalResult);
  return chain;
}

describe("resolveStoreIdBySlug", () => {
  it("PS-1: consulta a VIEW public_store_lookup filtrando por slug — nunca a tabela stores direto (anon não tem policy lá)", async () => {
    const chain = buildChain({ data: { id: "store-a" }, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof resolveStoreIdBySlug>[0];

    const storeId = await resolveStoreIdBySlug(supabase, "speedmotos");

    expect(storeId).toBe("store-a");
    expect(from).toHaveBeenCalledWith("public_store_lookup");
    expect(from).not.toHaveBeenCalledWith("stores");
    expect(chain.eq).toHaveBeenCalledWith("slug", "speedmotos");
  });

  it("PS-2: slug inexistente retorna null (não lança)", async () => {
    const chain = buildChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof resolveStoreIdBySlug>[0];

    const storeId = await resolveStoreIdBySlug(supabase, "loja-que-nao-existe");

    expect(storeId).toBeNull();
  });

  it("PS-3: erro de query é propagado (não engolido em silêncio)", async () => {
    const dbError = new Error("boom");
    const chain = buildChain({ data: null, error: dbError });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof resolveStoreIdBySlug>[0];

    await expect(resolveStoreIdBySlug(supabase, "speedmotos")).rejects.toThrow(
      "boom"
    );
  });
});

describe("getPublicVehicleListings", () => {
  it("PS-4: consulta a VIEW public_vehicle_listings, nunca a tabela vehicles direto", async () => {
    const chain = buildChain({ data: [], error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleListings>[0];

    await getPublicVehicleListings(supabase, "store-a");

    expect(from).toHaveBeenCalledWith("public_vehicle_listings");
    expect(from).not.toHaveBeenCalledWith("vehicles");
  });

  it("PS-5: filtra sempre por store_id — isolamento na construção da query", async () => {
    const chain = buildChain({ data: [], error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleListings>[0];

    await getPublicVehicleListings(supabase, "store-a");

    expect(chain.eq).toHaveBeenCalledWith("store_id", "store-a");
  });

  it("PS-6: select() nunca pede custo nem margem_minima — allowlist explícita, não '*'", async () => {
    const chain = buildChain({ data: [], error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleListings>[0];

    await getPublicVehicleListings(supabase, "store-a");

    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).not.toContain("custo");
    expect(selectedColumns).not.toContain("margem_minima");
    expect(selectedColumns).not.toBe("*");
    expect(selectedColumns).toContain("id");
    expect(selectedColumns).toContain("preco");
    expect(selectedColumns).toContain("photo_url");
  });

  it("PS-7: retorna [] quando a view não tem linhas (nunca lança para lista vazia)", async () => {
    const chain = buildChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleListings>[0];

    const result = await getPublicVehicleListings(supabase, "store-a");

    expect(result).toEqual([]);
  });

  it("PS-8: erro de query é propagado", async () => {
    const dbError = new Error("view unavailable");
    const chain = buildChain({ data: null, error: dbError });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleListings>[0];

    await expect(getPublicVehicleListings(supabase, "store-a")).rejects.toThrow(
      "view unavailable"
    );
  });
});

// ---------------------------------------------------------------------------
// getPublicVehicleById (roadmap 1.4 — página de detalhe do site público)
// ---------------------------------------------------------------------------

describe("getPublicVehicleById", () => {
  it("PS-9: consulta a VIEW public_vehicle_listings, nunca a tabela vehicles direto", async () => {
    const chain = buildChain({ data: { id: "v-1", store_id: "store-a" }, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleById>[0];

    await getPublicVehicleById(supabase, "store-a", "v-1");

    expect(from).toHaveBeenCalledWith("public_vehicle_listings");
    expect(from).not.toHaveBeenCalledWith("vehicles");
  });

  it("PS-10: filtra por store_id E id — isolamento cross-tenant na busca por id", async () => {
    const chain = buildChain({ data: { id: "v-1", store_id: "store-a" }, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleById>[0];

    await getPublicVehicleById(supabase, "store-a", "v-1");

    expect(chain.eq).toHaveBeenCalledWith("store_id", "store-a");
    expect(chain.eq).toHaveBeenCalledWith("id", "v-1");
  });

  it("PS-11: select() nunca pede custo nem margem_minima — mesma allowlist da listagem", async () => {
    const chain = buildChain({ data: { id: "v-1", store_id: "store-a" }, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleById>[0];

    await getPublicVehicleById(supabase, "store-a", "v-1");

    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).not.toContain("custo");
    expect(selectedColumns).not.toContain("margem_minima");
    expect(selectedColumns).not.toBe("*");
  });

  it("PS-12: retorna null quando o veículo não existe / não pertence à store (nunca lança)", async () => {
    const chain = buildChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleById>[0];

    const result = await getPublicVehicleById(supabase, "store-a", "v-inexistente");

    expect(result).toBeNull();
  });

  it("PS-13: erro de query é propagado", async () => {
    const dbError = new Error("view unavailable");
    const chain = buildChain({ data: null, error: dbError });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicVehicleById>[0];

    await expect(getPublicVehicleById(supabase, "store-a", "v-1")).rejects.toThrow(
      "view unavailable"
    );
  });
});

// ---------------------------------------------------------------------------
// getPublicStoreBySlug (roadmap 1.5 — config visual por loja)
// ---------------------------------------------------------------------------

describe("getPublicStoreBySlug", () => {
  const row = {
    id: "store-a",
    slug: "speedmotos",
    nome: "Speed Motos",
    logo_url: "https://x/logo.png",
    cor_primaria: "#FF0000",
    telefone_publico: "+55 11 99999-0000",
    endereco: "Rua A, 123",
    sobre: "Loja de motos usadas.",
  };

  it("PS-14: consulta a VIEW public_store_lookup filtrando por slug — nunca a tabela stores direto", async () => {
    const chain = buildChain({ data: row, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicStoreBySlug>[0];

    const store = await getPublicStoreBySlug(supabase, "speedmotos");

    expect(store).toEqual(row);
    expect(from).toHaveBeenCalledWith("public_store_lookup");
    expect(from).not.toHaveBeenCalledWith("stores");
    expect(chain.eq).toHaveBeenCalledWith("slug", "speedmotos");
  });

  it("PS-15: select() nunca pede whatsapp_numero nem whatsapp_phone_number_id — allowlist explícita", async () => {
    const chain = buildChain({ data: row, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicStoreBySlug>[0];

    await getPublicStoreBySlug(supabase, "speedmotos");

    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).not.toContain("whatsapp");
    expect(selectedColumns).not.toBe("*");
    expect(selectedColumns).toContain("nome");
    expect(selectedColumns).toContain("logo_url");
    expect(selectedColumns).toContain("cor_primaria");
    expect(selectedColumns).toContain("telefone_publico");
    expect(selectedColumns).toContain("endereco");
    expect(selectedColumns).toContain("sobre");
  });

  it("PS-16: slug inexistente retorna null (não lança)", async () => {
    const chain = buildChain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicStoreBySlug>[0];

    const store = await getPublicStoreBySlug(supabase, "loja-que-nao-existe");

    expect(store).toBeNull();
  });

  it("PS-17: erro de query é propagado", async () => {
    const dbError = new Error("boom");
    const chain = buildChain({ data: null, error: dbError });
    const from = vi.fn().mockReturnValue(chain);
    const supabase = { from } as unknown as Parameters<typeof getPublicStoreBySlug>[0];

    await expect(getPublicStoreBySlug(supabase, "speedmotos")).rejects.toThrow("boom");
  });
});
