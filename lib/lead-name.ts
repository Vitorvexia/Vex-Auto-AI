const HAS_LETTER_RE = /\p{L}/u;

/** Nome válido pra vocativo: precisa ter ao menos 1 letra Unicode após trim (emoji/símbolo sozinho não conta). */
export function isValidLeadName(nome: string | null | undefined): boolean {
  const trimmed = nome?.trim() ?? "";
  return trimmed !== "" && HAS_LETTER_RE.test(trimmed);
}

/** Nome pra usar em templates — nome trimado se válido, "você" como fallback (null/vazio/emoji/símbolo). */
export function getSafeName(nome: string | null | undefined): string {
  const trimmed = nome?.trim() ?? "";
  return isValidLeadName(trimmed) ? trimmed : "você";
}
