/**
 * Mascaramento de PII para logs — LGPD compliance.
 * Centraliza toda lógica de masking em um único módulo.
 */

/**
 * Mascara telefone preservando prefixo (5 chars) e sufixo (4 chars).
 * Phones < 9 chars: preserva últimos 2 apenas.
 * E.164: +5531999998888 → +5531*****8888
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  const PREFIX = 5;
  const SUFFIX = 4;
  if (phone.length < PREFIX + SUFFIX) {
    const visible = Math.min(2, phone.length);
    return "*".repeat(phone.length - visible) + phone.slice(-visible);
  }
  const prefix = phone.slice(0, PREFIX);
  const suffix = phone.slice(-SUFFIX);
  const middle = "*".repeat(phone.length - PREFIX - SUFFIX);
  return prefix + middle + suffix;
}

/**
 * Mascara email preservando primeiro char do local e domínio completo.
 * joao@gmail.com → j***@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const atIdx = email.indexOf("@");
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length <= 1) return email;
  return local[0] + "***" + domain;
}

/**
 * Mascara sobrenome preservando primeiro nome e inicial do último sobrenome.
 * João Silva → João S***
 * Nome único: João → Jo***
 */
export function maskName(name: string): string {
  if (!name) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const word = parts[0];
    return word.slice(0, 2) + "***";
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}***`;
}
