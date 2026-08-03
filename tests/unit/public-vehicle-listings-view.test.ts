/**
 * Guarda estrutural da view public_vehicle_listings (migration 034) — lê a
 * migration do disco e verifica a allowlist de colunas na origem.
 *
 * Por quê este teste, além do de integração (PVL-4 em
 * tests/integration/public-vehicle-listings.test.ts): PVL-4 prova que custo/
 * margem_minima não aparecem HOJE, contra o schema atual. Mas ele só roda
 * contra Supabase real (skip sem credenciais) e só prova o presente. Este
 * teste unit lê a definição da view diretamente do arquivo .sql — se alguém
 * no futuro editar a migration pra `select *` (o que passaria a herdar
 * QUALQUER coluna nova adicionada em `vehicles`, incluindo futuras colunas
 * sensíveis), ou adicionar custo/margem_minima na lista explícita, este
 * teste quebra sem precisar de banco nenhum. É a garantia que sobrevive a
 * uma mudança futura de schema em `vehicles` que o teste de integração,
 * sozinho, não cobre (ele só re-valida contra o schema do momento em que
 * roda).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/034_public_vehicle_listings.sql"
);

function extractViewSelectList(sql: string): string {
  const match = sql.match(
    /CREATE VIEW public\.public_vehicle_listings[\s\S]*?SELECT([\s\S]*?)FROM public\.vehicles/i
  );
  if (!match) {
    throw new Error(
      "Não encontrou o bloco SELECT...FROM public.vehicles na migration 034 — a estrutura do arquivo mudou, ajuste este teste."
    );
  }
  return match[1];
}

describe("view public_vehicle_listings — allowlist estrutural (migration 034)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");
  const selectList = extractViewSelectList(sql);

  it("VIEW-1: a view NUNCA seleciona custo, mesmo que vehicles ganhe colunas novas no futuro", () => {
    expect(selectList.toLowerCase()).not.toContain("custo");
  });

  it("VIEW-2: a view NUNCA seleciona margem_minima, mesmo que vehicles ganhe colunas novas no futuro", () => {
    expect(selectList.toLowerCase()).not.toContain("margem_minima");
  });

  it("VIEW-3: a view usa allowlist explícita de colunas, nunca select(*) — só assim uma coluna nova em vehicles fica de fora por padrão", () => {
    expect(selectList.trim()).not.toBe("*");
    expect(selectList).toMatch(/\bid\b/);
    expect(selectList).toMatch(/\bstore_id\b/);
    expect(selectList).toMatch(/\bpreco\b/);
    expect(selectList).toMatch(/\bphoto_url\b/);
    expect(selectList).toMatch(/\bdisponivel\b/);
  });

  it("VIEW-4: filtro disponivel = true está embutido na própria view (mecanismo real da decisão nº 4, não RLS — Postgres não suporta RLS em views)", () => {
    expect(sql).toMatch(/WHERE\s+disponivel\s*=\s*true/i);
  });

  it("VIEW-5: grant explícito de SELECT ao role anon existe na migration", () => {
    expect(sql).toMatch(/GRANT SELECT ON public\.public_vehicle_listings TO anon/i);
  });
});
