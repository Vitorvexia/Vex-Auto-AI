import { describe, it, expect } from "vitest";
import { validateDemoRequest } from "@/lib/demo-request";

describe("validateDemoRequest — validação pura da captura de lead da landing (roadmap 1.7)", () => {
  const valid = {
    nome: "Vitor",
    empresa: "Speed Motos",
    telefone: "+55 11 99999-0000",
  };

  it("DR-1: input completo mínimo é válido", () => {
    expect(validateDemoRequest(valid)).toEqual({ valid: true });
  });

  it("DR-2: nome ausente/vazio é inválido", () => {
    expect(validateDemoRequest({ ...valid, nome: "" })).toEqual({
      valid: false,
      field: "nome",
      message: "Informe seu nome.",
    });
  });

  it("DR-3: nome só com espaços é inválido", () => {
    expect(validateDemoRequest({ ...valid, nome: "   " })).toEqual({
      valid: false,
      field: "nome",
      message: "Informe seu nome.",
    });
  });

  it("DR-4: empresa ausente é inválida", () => {
    expect(validateDemoRequest({ ...valid, empresa: "" })).toEqual({
      valid: false,
      field: "empresa",
      message: "Informe o nome da empresa.",
    });
  });

  it("DR-5: telefone ausente é inválido", () => {
    expect(validateDemoRequest({ ...valid, telefone: "" })).toEqual({
      valid: false,
      field: "telefone",
      message: "Informe seu telefone.",
    });
  });

  it("DR-6: email ausente é válido (opcional)", () => {
    expect(validateDemoRequest({ ...valid, email: null })).toEqual({
      valid: true,
    });
  });

  it("DR-7: email presente e válido passa", () => {
    expect(
      validateDemoRequest({ ...valid, email: "vitor@speedmotos.com.br" })
    ).toEqual({ valid: true });
  });

  it("DR-8: email presente mas malformado é inválido", () => {
    expect(validateDemoRequest({ ...valid, email: "não-é-email" })).toEqual({
      valid: false,
      field: "email",
      message: "E-mail inválido.",
    });
  });

  it("DR-9: mensagem ausente é válida (opcional)", () => {
    expect(validateDemoRequest({ ...valid, mensagem: null })).toEqual({
      valid: true,
    });
  });

  it("DR-10: mensagem dentro do limite é válida", () => {
    expect(
      validateDemoRequest({ ...valid, mensagem: "a".repeat(2000) })
    ).toEqual({ valid: true });
  });

  it("DR-11: mensagem acima do limite é inválida", () => {
    expect(
      validateDemoRequest({ ...valid, mensagem: "a".repeat(2001) })
    ).toEqual({
      valid: false,
      field: "mensagem",
      message: "Mensagem muito longa (máx. 2000 caracteres).",
    });
  });
});
