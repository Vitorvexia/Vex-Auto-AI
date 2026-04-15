/**
 * Normaliza um telefone para formato E.164 (+5511999990000).
 * Remove todos os caracteres nao numericos e adiciona "+" no inicio.
 * Retorna null se o resultado nao tiver comprimento plausivel (8-15 digitos).
 */
export function normalizePhone(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
