import { describe, it, expect } from "vitest";
import {
  STORE_LOGO_BUCKET,
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_BYTES,
  isValidHexColor,
  sanitizeStoreText,
  validateLogoFile,
} from "@/lib/store-settings";

describe("isValidHexColor", () => {
  it("aceita hex maiúsculo válido", () => {
    expect(isValidHexColor("#FF0000")).toBe(true);
  });

  it("aceita hex minúsculo válido", () => {
    expect(isValidHexColor("#a1b2c3")).toBe(true);
  });

  it("rejeita sem #", () => {
    expect(isValidHexColor("FF0000")).toBe(false);
  });

  it("rejeita com menos de 6 dígitos", () => {
    expect(isValidHexColor("#FFF")).toBe(false);
  });

  it("rejeita com mais de 6 dígitos", () => {
    expect(isValidHexColor("#FF00000")).toBe(false);
  });

  it("rejeita caractere não-hex", () => {
    expect(isValidHexColor("#GG0000")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(isValidHexColor("")).toBe(false);
  });

  it("rejeita nulo/undefined", () => {
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
  });
});

describe("sanitizeStoreText", () => {
  it("remove espaços nas pontas", () => {
    expect(sanitizeStoreText("  Rua A, 123  ", 50)).toBe("Rua A, 123");
  });

  it("trunca no limite de tamanho", () => {
    expect(sanitizeStoreText("a".repeat(20), 10)).toBe("a".repeat(10));
  });

  it("mantém string dentro do limite intacta", () => {
    expect(sanitizeStoreText("abc", 10)).toBe("abc");
  });

  it("nulo/undefined vira string vazia", () => {
    expect(sanitizeStoreText(null, 10)).toBe("");
    expect(sanitizeStoreText(undefined, 10)).toBe("");
  });

  it("trunca depois de aparar espaços (não conta espaço de borda no limite)", () => {
    expect(sanitizeStoreText("   abcdef   ", 4)).toBe("abcd");
  });
});

describe("validateLogoFile", () => {
  it("aceita jpeg dentro do limite", () => {
    expect(validateLogoFile({ type: "image/jpeg", size: 1024, name: "logo.jpg" }).ok).toBe(true);
  });

  it("aceita png dentro do limite", () => {
    expect(validateLogoFile({ type: "image/png", size: 1024, name: "logo.png" }).ok).toBe(true);
  });

  it("aceita webp dentro do limite", () => {
    expect(validateLogoFile({ type: "image/webp", size: 1024, name: "logo.webp" }).ok).toBe(true);
  });

  it("rejeita tipo não permitido", () => {
    const result = validateLogoFile({ type: "application/pdf", size: 1024, name: "logo.pdf" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tipo/i);
  });

  it("rejeita arquivo vazio", () => {
    expect(validateLogoFile({ type: "image/jpeg", size: 0, name: "logo.jpg" }).ok).toBe(false);
  });

  it("rejeita acima de 2MB", () => {
    const result = validateLogoFile({
      type: "image/jpeg",
      size: MAX_LOGO_SIZE_BYTES + 1,
      name: "logo.jpg",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/grande/i);
  });

  it("aceita exatamente no limite de 2MB", () => {
    expect(
      validateLogoFile({ type: "image/jpeg", size: MAX_LOGO_SIZE_BYTES, name: "logo.jpg" }).ok
    ).toBe(true);
  });
});

describe("constantes exportadas", () => {
  it("bucket, tipos permitidos, limite de 2MB", () => {
    expect(STORE_LOGO_BUCKET).toBe("store-logos");
    expect(ALLOWED_LOGO_TYPES).toContain("image/jpeg");
    expect(ALLOWED_LOGO_TYPES).toContain("image/png");
    expect(ALLOWED_LOGO_TYPES).toContain("image/webp");
    expect(MAX_LOGO_SIZE_BYTES).toBe(2 * 1024 * 1024);
  });
});
