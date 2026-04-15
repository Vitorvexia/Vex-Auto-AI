import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("preserva E.164 ja valido", () => {
    expect(normalizePhone("+5511988887777")).toBe("+5511988887777");
  });

  it("adiciona '+' quando ausente", () => {
    expect(normalizePhone("5511988887777")).toBe("+5511988887777");
  });

  it("remove formatacao (espacos, parenteses, hifens)", () => {
    expect(normalizePhone("+55 (11) 98888-7777")).toBe("+5511988887777");
    expect(normalizePhone("(11) 98888-7777")).toBe("+11988887777");
  });

  it("retorna null para null/undefined/vazio", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("retorna null para string so com simbolos", () => {
    expect(normalizePhone("()-+ ")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("retorna null para menos de 8 digitos", () => {
    expect(normalizePhone("1234567")).toBeNull();
    expect(normalizePhone("+12")).toBeNull();
  });

  it("retorna null para mais de 15 digitos", () => {
    expect(normalizePhone("1234567890123456")).toBeNull();
  });

  it("aceita limites de tamanho (8 e 15 digitos)", () => {
    expect(normalizePhone("12345678")).toBe("+12345678");
    expect(normalizePhone("123456789012345")).toBe("+123456789012345");
  });

  it("eh idempotente (apply duas vezes nao muda)", () => {
    const once = normalizePhone("+55 (11) 98888-7777")!;
    expect(normalizePhone(once)).toBe(once);
  });

  it("ignora + embutido no meio", () => {
    // "+55+11988887777" -> strip non-digits -> "5511988887777"
    expect(normalizePhone("+55+11988887777")).toBe("+5511988887777");
  });
});
