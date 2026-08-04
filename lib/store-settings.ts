// Config visual por loja (roadmap 1.5) — validação pura, sem I/O.
// Bucket público pra leitura (site da loja usa) — escrita restrita ao
// store_id do usuário via Server Action + RLS de storage.objects
// (migration 039), mesma dupla camada usada em lib/vehicle-photos.ts.

export const STORE_LOGO_BUCKET = "store-logos";

export const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 2MB — logo é imagem pequena/otimizada, não precisa do limite de foto de veículo (5MB). */
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return HEX_COLOR_RE.test(value);
}

export function sanitizeStoreText(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  return value.trim().slice(0, maxLength);
}

export interface LogoFileInput {
  type: string;
  size: number;
  name: string;
}

export interface LogoValidationResult {
  ok: boolean;
  error?: string;
}

export function validateLogoFile(file: LogoFileInput): LogoValidationResult {
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: `Tipo de arquivo não permitido: ${file.type || "desconhecido"}. Use JPEG, PNG ou WEBP.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return {
      ok: false,
      error: `Arquivo muito grande (máx ${Math.round(MAX_LOGO_SIZE_BYTES / (1024 * 1024))}MB).`,
    };
  }
  return { ok: true };
}
