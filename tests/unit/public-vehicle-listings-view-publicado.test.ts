/**
 * Guarda estrutural da migration 037 — view public_vehicle_listings passa a
 * filtrar publicado=true além de disponivel=true (roadmap 1.4). Mesmo padrão
 * de tests/unit/public-vehicle-listings-view.test.ts (migration 034): lê a
 * migration do disco, não depende de banco real, quebra se a allowlist ou o
 * filtro forem alterados no futuro sem querer.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/037_public_vehicle_listings_publicado.sql"
);

function extractViewSelectList(sql: string): string {
  const match = sql.match(
    /CREATE OR REPLACE VIEW public\.public_vehicle_listings[\s\S]*?SELECT([\s\S]*?)FROM public\.vehicles/i
  );
  if (!match) {
    throw new Error(
      "Não encontrou o bloco SELECT...FROM public.vehicles na migration 037 — a estrutura do arquivo mudou, ajuste este teste."
    );
  }
  return match[1];
}

describe("view public_vehicle_listings — filtro publicado (migration 037, roadmap 1.4)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");
  const selectList = extractViewSelectList(sql);

  it("VIEWPUB-1: WHERE exige disponivel=true E publicado=true", () => {
    expect(sql).toMatch(/WHERE\s+disponivel\s*=\s*true\s+AND\s+publicado\s*=\s*true/i);
  });

  it("VIEWPUB-2: allowlist segue sem custo, mesmo após a alteração", () => {
    expect(selectList.toLowerCase()).not.toContain("custo");
  });

  it("VIEWPUB-3: allowlist segue sem margem_minima, mesmo após a alteração", () => {
    expect(selectList.toLowerCase()).not.toContain("margem_minima");
  });

  it("VIEWPUB-4: coluna publicado não é exposta no SELECT — é filtro de linha, não dado público", () => {
    expect(selectList).not.toMatch(/\bpublicado\b/);
  });

  it("VIEWPUB-5: allowlist explícita preservada (nunca select *)", () => {
    expect(selectList.trim()).not.toBe("*");
    expect(selectList).toMatch(/\bid\b/);
    expect(selectList).toMatch(/\bstore_id\b/);
    expect(selectList).toMatch(/\bphoto_url\b/);
  });

  it("VIEWPUB-6: grant explícito de SELECT ao role anon reafirmado", () => {
    expect(sql).toMatch(/GRANT SELECT ON public\.public_vehicle_listings TO anon/i);
  });
});
