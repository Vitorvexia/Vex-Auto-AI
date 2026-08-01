// Upload de foto de veículo (roadmap 1.2) — validação pura, sem I/O.
// Bucket público pra leitura (site da loja, 1.4, é rota sem sessão) — escrita
// restrita ao store_id do usuário via Server Action + RLS de storage.objects
// (migration 032), mesma dupla camada usada nas tabelas (CLAUDE.md).

export const VEHICLE_PHOTOS_BUCKET = "vehicle-photos";

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 5MB — suficiente pra foto de celular comprimida, evita upload de RAW/vídeo por engano. */
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

/** 10 fotos por veículo — cobre galeria completa sem virar álbum ilimitado. */
export const MAX_PHOTOS_PER_VEHICLE = 10;

export interface PhotoFileInput {
  type: string;
  size: number;
  name: string;
}

export interface PhotoValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePhotoFile(file: PhotoFileInput): PhotoValidationResult {
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: `Tipo de arquivo não permitido: ${file.type || "desconhecido"}. Use JPEG, PNG ou WEBP.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return {
      ok: false,
      error: `Arquivo muito grande (máx ${Math.round(MAX_PHOTO_SIZE_BYTES / (1024 * 1024))}MB).`,
    };
  }
  return { ok: true };
}

export function validatePhotoBatch(
  existingCount: number,
  files: PhotoFileInput[]
): PhotoValidationResult {
  if (files.length === 0) {
    return { ok: false, error: "Selecione ao menos uma foto." };
  }
  if (existingCount + files.length > MAX_PHOTOS_PER_VEHICLE) {
    return {
      ok: false,
      error: `Limite de ${MAX_PHOTOS_PER_VEHICLE} fotos por veículo excedido (${existingCount} já cadastrada${existingCount === 1 ? "" : "s"}, ${files.length} nova${files.length === 1 ? "" : "s"}).`,
    };
  }
  for (const file of files) {
    const check = validatePhotoFile(file);
    if (!check.ok) return check;
  }
  return { ok: true };
}

/** Nome de arquivo seguro pra path de storage — sem traversal, sem espaço/maiúscula. */
export function sanitizeFilename(name: string): string {
  const lastSegment = name.trim().toLowerCase().split(/[\\/]/).pop() ?? "";
  const cleaned = lastSegment
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-\./g, ".")
    .replace(/^-+|-+$/g, "");
  return cleaned || "foto";
}

export function buildVehiclePhotoPath(
  storeId: string,
  vehicleId: string,
  filename: string,
  uniqueSuffix: string | number = Date.now()
): string {
  return `${storeId}/${vehicleId}/${uniqueSuffix}-${sanitizeFilename(filename)}`;
}
