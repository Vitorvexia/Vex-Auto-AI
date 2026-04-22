/**
 * Normaliza um telefone para formato E.164 (+5511999990000).
 * Remove todos os caracteres nao numericos e adiciona "+" no inicio.
 * Retorna null se o resultado nao tiver comprimento plausivel (8-15 digitos).
 *
 * Tratamento especial — Brasil (55):
 *   WhatsApp Business API envia numeros de celular no formato antigo (8 digitos
 *   apos o DDD). Desde 2012, celulares brasileiros exigem 9 digitos. Convertemos
 *   automaticamente: 55 + DDD (2) + 8 digitos → 55 + DDD + 9 + 8 digitos.
 *   Exemplo: 553299731461 → 5532999731461
 *
 *   Fixos BR (DDD + 2-5) NAO recebem o 9 — apenas celulares (primeiro digito >= 6).
 */
export function normalizePhone(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");

  // Brasil: celular no formato antigo (12 digitos = 55 + DDD + 8)
  // Primeiro digito apos DDD >= 6 → celular; < 6 → fixo (nao altera)
  if (
    digits.startsWith("55") &&
    digits.length === 12 &&
    parseInt(digits[4]) >= 6
  ) {
    digits = "55" + digits.slice(2, 4) + "9" + digits.slice(4);
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
