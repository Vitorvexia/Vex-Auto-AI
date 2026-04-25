import { describe, it, expect, beforeEach, vi } from "vitest";

// Rate limiter usa Map module-level — resetar entre testes via reimport
// Vitest + isolate garante módulo fresco por arquivo

let checkRateLimit: (phone: string) => boolean;
let checkStoreRateLimit: (storeId: string) => boolean;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("@/lib/rate-limiter");
  checkRateLimit = mod.checkRateLimit;
  checkStoreRateLimit = mod.checkStoreRateLimit;
});

describe("checkRateLimit", () => {
  it("permite primeira mensagem de um número", () => {
    expect(checkRateLimit("+5511999990001")).toBe(true);
  });

  it("permite até 10 mensagens no mesmo número dentro da janela", () => {
    const phone = "+5511999990002";
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(phone)).toBe(true);
    }
  });

  it("bloqueia a 11ª mensagem do mesmo número", () => {
    const phone = "+5511999990003";
    for (let i = 0; i < 10; i++) checkRateLimit(phone);
    expect(checkRateLimit(phone)).toBe(false);
  });

  it("números diferentes têm contagens independentes", () => {
    const phoneA = "+5511999990004";
    const phoneB = "+5511999990005";
    for (let i = 0; i < 10; i++) checkRateLimit(phoneA);
    // phoneA esgotado — phoneB deve passar
    expect(checkRateLimit(phoneB)).toBe(true);
    expect(checkRateLimit(phoneA)).toBe(false);
  });

  it("continua bloqueando após atingir o limite", () => {
    const phone = "+5511999990006";
    for (let i = 0; i < 10; i++) checkRateLimit(phone);
    expect(checkRateLimit(phone)).toBe(false);
    expect(checkRateLimit(phone)).toBe(false);
  });
});

describe("checkStoreRateLimit", () => {
  it("permite primeira mensagem de uma loja", () => {
    expect(checkStoreRateLimit("store-uuid-001")).toBe(true);
  });

  it("permite até 100 mensagens por loja na janela", () => {
    const storeId = "store-uuid-002";
    for (let i = 0; i < 100; i++) {
      expect(checkStoreRateLimit(storeId)).toBe(true);
    }
  });

  it("bloqueia a 101ª mensagem da loja", () => {
    const storeId = "store-uuid-003";
    for (let i = 0; i < 100; i++) checkStoreRateLimit(storeId);
    expect(checkStoreRateLimit(storeId)).toBe(false);
  });

  it("lojas diferentes têm contagens independentes", () => {
    const storeA = "store-uuid-004";
    const storeB = "store-uuid-005";
    for (let i = 0; i < 100; i++) checkStoreRateLimit(storeA);
    expect(checkStoreRateLimit(storeB)).toBe(true);
    expect(checkStoreRateLimit(storeA)).toBe(false);
  });

  it("limite por loja é independente do limite por telefone", () => {
    const storeId = "store-uuid-006";
    const phone = "+5511999990099";
    // esgotar telefone mas loja ainda OK
    for (let i = 0; i < 10; i++) checkRateLimit(phone);
    expect(checkRateLimit(phone)).toBe(false);
    // loja ainda permite
    expect(checkStoreRateLimit(storeId)).toBe(true);
  });
});
