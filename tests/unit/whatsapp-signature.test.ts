import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature } from "@/lib/whatsapp-signature";

const SECRET = "test-secret-abc123";
const BODY = JSON.stringify({ hello: "world", n: 42 });

function signWith(secret: string, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyMetaSignature", () => {
  beforeEach(() => {
    vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
    vi.stubEnv("WHATSAPP_ALLOW_UNSIGNED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita assinatura valida", () => {
    expect(verifyMetaSignature(BODY, signWith(SECRET, BODY))).toBe(true);
  });

  it("rejeita corpo diferente (sig calculada para outro body)", () => {
    const other = JSON.stringify({ hello: "other" });
    expect(verifyMetaSignature(other, signWith(SECRET, BODY))).toBe(false);
  });

  it("rejeita secret diferente", () => {
    expect(verifyMetaSignature(BODY, signWith("wrong-secret", BODY))).toBe(
      false
    );
  });

  it("rejeita header null", () => {
    expect(verifyMetaSignature(BODY, null)).toBe(false);
  });

  it("rejeita header sem prefixo sha256=", () => {
    const hex = createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyMetaSignature(BODY, hex)).toBe(false);
  });

  it("rejeita tamanho diferente (sem disparar timingSafeEqual)", () => {
    expect(verifyMetaSignature(BODY, "sha256=abcd")).toBe(false);
  });

  it("rejeita um byte alterado", () => {
    const sig = signWith(SECRET, BODY);
    const tampered =
      sig.slice(0, -1) + (sig[sig.length - 1] === "0" ? "1" : "0");
    expect(verifyMetaSignature(BODY, tampered)).toBe(false);
  });

  it("sem APP_SECRET + ALLOW_UNSIGNED=true => aceita qualquer coisa (dev)", () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    vi.stubEnv("WHATSAPP_ALLOW_UNSIGNED", "true");
    expect(verifyMetaSignature(BODY, null)).toBe(true);
    expect(verifyMetaSignature(BODY, "sha256=qualquer")).toBe(true);
  });

  it("sem APP_SECRET + ALLOW_UNSIGNED!=true => rejeita tudo", () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    vi.stubEnv("WHATSAPP_ALLOW_UNSIGNED", "false");
    expect(verifyMetaSignature(BODY, signWith(SECRET, BODY))).toBe(false);
    expect(verifyMetaSignature(BODY, null)).toBe(false);
  });
});
