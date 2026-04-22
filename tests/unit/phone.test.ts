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

  it("normaliza celular BR no formato antigo (8 digitos) adicionando o 9", () => {
    // WA Business API envia 553299731461 (12 digitos, primeiro digito apos DDD >= 6)
    // deve virar +5532999731461 (13 digitos)
    expect(normalizePhone("553299731461")).toBe("+5532999731461");
    // celular DDD 11 com primeiro digito 8 — tambem recebe o 9
    expect(normalizePhone("551188887777")).toBe("+5511988887777");
    expect(normalizePhone("5511987654321")).toBe("+5511987654321"); // já 13 → não altera
    expect(normalizePhone("5521981234567")).toBe("+5521981234567"); // já 13 → não altera
  });

  it("nao insere 9 em fixo BR (primeiro digito apos DDD < 6)", () => {
    // Fixo DDD 32: 55 32 3398-1234 → 12 digitos, primeiro digito apos DDD = 3
    expect(normalizePhone("553233981234")).toBe("+553233981234");
    // Fixo DDD 11: 55 11 3999-1234 → 12 digitos, primeiro digito apos DDD = 3
    expect(normalizePhone("551139991234")).toBe("+551139991234");
  });
});
