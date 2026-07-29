/**
 * Testes unitários para lib/lead-name.ts
 *
 * Coberturas:
 * - isValidLeadName: null/vazio/espaço/emoji/símbolo vs nome válido
 * - getSafeName: fallback "você" pros mesmos casos inválidos
 */

import { describe, it, expect } from "vitest";
import { isValidLeadName, getSafeName } from "@/lib/lead-name";

describe("isValidLeadName", () => {
  it("null é inválido", () => {
    expect(isValidLeadName(null)).toBe(false);
  });

  it("undefined é inválido", () => {
    expect(isValidLeadName(undefined)).toBe(false);
  });

  it("string vazia é inválida", () => {
    expect(isValidLeadName("")).toBe(false);
  });

  it("string só espaço é inválida", () => {
    expect(isValidLeadName("   ")).toBe(false);
  });

  it("emoji sozinho é inválido", () => {
    expect(isValidLeadName("😊")).toBe(false);
  });

  it("múltiplos emojis são inválidos", () => {
    expect(isValidLeadName("🙂🙂")).toBe(false);
  });

  it("símbolo sozinho é inválido", () => {
    expect(isValidLeadName("-")).toBe(false);
  });

  it("pontuação sozinha é inválida", () => {
    expect(isValidLeadName("...")).toBe(false);
  });

  it("nome válido é válido", () => {
    expect(isValidLeadName("Carlos")).toBe(true);
  });

  it("nome válido com espaços extras é válido", () => {
    expect(isValidLeadName("  Ana  ")).toBe(true);
  });

  it("nome com emoji misto a letra é válido", () => {
    expect(isValidLeadName("Carlos 😊")).toBe(true);
  });
});

describe("getSafeName", () => {
  it("null vira 'você'", () => {
    expect(getSafeName(null)).toBe("você");
  });

  it("undefined vira 'você'", () => {
    expect(getSafeName(undefined)).toBe("você");
  });

  it("string vazia vira 'você'", () => {
    expect(getSafeName("")).toBe("você");
  });

  it("string só espaço vira 'você'", () => {
    expect(getSafeName("   ")).toBe("você");
  });

  it("emoji sozinho vira 'você'", () => {
    expect(getSafeName("😊")).toBe("você");
  });

  it("símbolo sozinho vira 'você'", () => {
    expect(getSafeName("-")).toBe("você");
  });

  it("nome válido é retornado trimado", () => {
    expect(getSafeName("  Ana  ")).toBe("Ana");
  });

  it("nome válido sem espaços extras é retornado igual", () => {
    expect(getSafeName("Carlos")).toBe("Carlos");
  });
});
