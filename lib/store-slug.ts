// Slug de loja (roadmap 1.3, migration 033) — identificador amigável de URL
// (ex: "speedmotos" em speedmotos.vexauto.com.br). Mesmo algoritmo do backfill
// da migration 033 (unaccent + lower + nao-alfanumerico->hifen + trim), agora
// reaproveitado em criacoes novas via app/admin/actions.ts::createStore —
// migration 033 so cobriu as lojas que ja existiam na hora em que rodou.

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function slugifyStoreName(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "loja";
}

// Mesmo esquema de sufixo da migration 033 (row_number por created_at):
// primeira loja com aquele nome fica com o slug "limpo", cada colisao
// seguinte ganha "-2", "-3", ...
export function nextAvailableSlug(
  base: string,
  takenSlugs: Set<string> | string[]
): string {
  const taken = takenSlugs instanceof Set ? takenSlugs : new Set(takenSlugs);
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
