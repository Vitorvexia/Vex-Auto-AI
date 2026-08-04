import { describe, it, expect } from "vitest";
import { slugifyStoreName, nextAvailableSlug } from "@/lib/store-slug";

describe("slugifyStoreName — mesmo algoritmo do backfill da migration 033", () => {
  it("nome simples com espaço vira hífen", () => {
    expect(slugifyStoreName("Loja Teste Onboarding")).toBe("loja-teste-onboarding");
  });

  it("remove acentos (unaccent)", () => {
    expect(slugifyStoreName("Speed Motos São José")).toBe("speed-motos-sao-jose");
  });

  it("remove caracteres especiais, colapsa múltiplos separadores", () => {
    expect(slugifyStoreName("Moto & Cia!!! --- Ltda.")).toBe("moto-cia-ltda");
  });

  it("trima hífen no início/fim", () => {
    expect(slugifyStoreName("--Loja Teste--")).toBe("loja-teste");
  });

  it("nome só com símbolos/emoji → fallback 'loja'", () => {
    expect(slugifyStoreName("!!! 🏍️ ???")).toBe("loja");
  });

  it("string vazia → fallback 'loja'", () => {
    expect(slugifyStoreName("")).toBe("loja");
  });

  it("já em minúsculo/sem acento passa direto", () => {
    expect(slugifyStoreName("speedmotos")).toBe("speedmotos");
  });
});

describe("nextAvailableSlug — colisão vira sufixo -2, -3, ... (mesmo esquema da migration 033)", () => {
  it("slug livre → retorna o próprio base", () => {
    expect(nextAvailableSlug("loja-teste", [])).toBe("loja-teste");
  });

  it("base já usado → sufixo -2", () => {
    expect(nextAvailableSlug("loja-teste", ["loja-teste"])).toBe("loja-teste-2");
  });

  it("base e -2 usados → sufixo -3", () => {
    expect(nextAvailableSlug("loja-teste", ["loja-teste", "loja-teste-2"])).toBe("loja-teste-3");
  });

  it("aceita Set além de array", () => {
    expect(nextAvailableSlug("loja-teste", new Set(["loja-teste"]))).toBe("loja-teste-2");
  });

  it("slugs de outras lojas não interferem", () => {
    expect(nextAvailableSlug("loja-teste", ["outra-loja", "mais-uma"])).toBe("loja-teste");
  });
});
