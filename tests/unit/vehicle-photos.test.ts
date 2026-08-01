import { describe, it, expect } from "vitest";
import {
  VEHICLE_PHOTOS_BUCKET,
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_VEHICLE,
  validatePhotoFile,
  validatePhotoBatch,
  sanitizeFilename,
  buildVehiclePhotoPath,
} from "@/lib/vehicle-photos";

describe("validatePhotoFile", () => {
  it("aceita jpeg dentro do limite", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1024, name: "a.jpg" }).ok).toBe(true);
  });

  it("aceita png dentro do limite", () => {
    expect(validatePhotoFile({ type: "image/png", size: 1024, name: "a.png" }).ok).toBe(true);
  });

  it("aceita webp dentro do limite", () => {
    expect(validatePhotoFile({ type: "image/webp", size: 1024, name: "a.webp" }).ok).toBe(true);
  });

  it("rejeita tipo não permitido (ex: pdf)", () => {
    const result = validatePhotoFile({ type: "application/pdf", size: 1024, name: "a.pdf" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tipo/i);
  });

  it("rejeita arquivo vazio (0 bytes)", () => {
    const result = validatePhotoFile({ type: "image/jpeg", size: 0, name: "a.jpg" });
    expect(result.ok).toBe(false);
  });

  it("rejeita arquivo acima do limite de tamanho", () => {
    const result = validatePhotoFile({
      type: "image/jpeg",
      size: MAX_PHOTO_SIZE_BYTES + 1,
      name: "a.jpg",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/grande/i);
  });

  it("aceita arquivo exatamente no limite de tamanho", () => {
    expect(
      validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_SIZE_BYTES, name: "a.jpg" }).ok
    ).toBe(true);
  });
});

describe("validatePhotoBatch", () => {
  it("rejeita lote vazio", () => {
    const result = validatePhotoBatch(0, []);
    expect(result.ok).toBe(false);
  });

  it("aceita lote válido dentro do limite total", () => {
    const files = [
      { type: "image/jpeg", size: 1024, name: "a.jpg" },
      { type: "image/png", size: 1024, name: "b.png" },
    ];
    expect(validatePhotoBatch(0, files).ok).toBe(true);
  });

  it("rejeita quando existentes + novas excede MAX_PHOTOS_PER_VEHICLE", () => {
    const files = Array.from({ length: 3 }, (_, i) => ({
      type: "image/jpeg",
      size: 1024,
      name: `f${i}.jpg`,
    }));
    const result = validatePhotoBatch(MAX_PHOTOS_PER_VEHICLE - 2, files);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/limite/i);
  });

  it("aceita quando existentes + novas bate exatamente o limite", () => {
    const files = Array.from({ length: 2 }, (_, i) => ({
      type: "image/jpeg",
      size: 1024,
      name: `f${i}.jpg`,
    }));
    const result = validatePhotoBatch(MAX_PHOTOS_PER_VEHICLE - 2, files);
    expect(result.ok).toBe(true);
  });

  it("propaga o erro do primeiro arquivo inválido do lote", () => {
    const files = [
      { type: "image/jpeg", size: 1024, name: "a.jpg" },
      { type: "application/pdf", size: 1024, name: "b.pdf" },
    ];
    const result = validatePhotoBatch(0, files);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tipo/i);
  });
});

describe("sanitizeFilename", () => {
  it("mantém nome simples válido", () => {
    expect(sanitizeFilename("foto-1.jpg")).toBe("foto-1.jpg");
  });

  it("normaliza espaços e maiúsculas", () => {
    expect(sanitizeFilename("Foto Boa 1.JPG")).toBe("foto-boa-1.jpg");
  });

  it("descarta path traversal — mantém só o nome do arquivo", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("descarta path traversal com barra invertida (Windows)", () => {
    expect(sanitizeFilename("..\\..\\windows\\evil.jpg")).toBe("evil.jpg");
  });

  it("nunca retorna string vazia", () => {
    expect(sanitizeFilename("???.jpg")).not.toBe("");
    expect(sanitizeFilename("")).not.toBe("");
  });
});

describe("buildVehiclePhotoPath", () => {
  it("monta path no formato {store_id}/{vehicle_id}/{prefixo}-{filename}", () => {
    const path = buildVehiclePhotoPath("store-1", "vehicle-1", "foto.jpg", "12345");
    expect(path).toBe("store-1/vehicle-1/12345-foto.jpg");
  });

  it("sanitiza o filename dentro do path", () => {
    const path = buildVehiclePhotoPath("store-1", "vehicle-1", "Foto Ruim!.PNG", "1");
    expect(path).toBe("store-1/vehicle-1/1-foto-ruim.png");
  });
});

describe("constantes exportadas", () => {
  it("bucket, tipos permitidos, limites", () => {
    expect(VEHICLE_PHOTOS_BUCKET).toBe("vehicle-photos");
    expect(ALLOWED_PHOTO_TYPES).toContain("image/jpeg");
    expect(ALLOWED_PHOTO_TYPES).toContain("image/png");
    expect(ALLOWED_PHOTO_TYPES).toContain("image/webp");
    expect(MAX_PHOTO_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_PHOTOS_PER_VEHICLE).toBe(10);
  });
});
