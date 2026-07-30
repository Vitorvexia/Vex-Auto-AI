import { describe, it, expect } from "vitest";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

describe("scrubSentryEvent", () => {
  it("remove CPF de string aninhada em qualquer profundidade", () => {
    const event = {
      exception: { values: [{ value: "Erro ao processar CPF 123.456.789-00 do lead" }] },
    };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.exception.values[0].value).not.toContain("123.456.789-00");
    expect(result.exception.values[0].value).toContain("[cpf removido]");
  });

  it("remove CPF sem pontuação (11 dígitos seguidos)", () => {
    const event = { extra: { note: "cpf informado: 12345678900" } };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.extra.note).not.toContain("12345678900");
  });

  it("remove telefone E.164 de string aninhada", () => {
    const event = { extra: { note: "falha ao enviar pra +5511999998888" } };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.extra.note).not.toContain("+5511999998888");
    expect(result.extra.note).toContain("[telefone removido]");
  });

  it("redige valor inteiro quando a chave é PII conhecida, mesmo sem padrão CPF/telefone", () => {
    const event = { extra: { nome_completo: "João da Silva", cpf: "não-formatado-mas-sensivel" } };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.extra.nome_completo).toBe("[removido]");
    expect(result.extra.cpf).toBe("[removido]");
  });

  it("redige incoming_text e reply_text inteiros (conteúdo de mensagem do lead)", () => {
    const event = {
      extra: {
        incoming_text: "Meu CPF é 123.456.789-00 e meu telefone é 11999998888",
        reply_text: "Obrigado, João! Vamos verificar seu financiamento.",
      },
    };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.extra.incoming_text).toBe("[removido]");
    expect(result.extra.reply_text).toBe("[removido]");
  });

  it("redige reply_texts (array de bolhas) inteiro, mesma disciplina de reply_text", () => {
    const event = {
      extra: {
        reply_texts: ["Obrigado, João!", "Vamos verificar seu financiamento."],
      },
    };
    const result = scrubSentryEvent(event) as { extra: { reply_texts: unknown } };
    expect(result.extra.reply_texts).toBe("[removido]");
  });

  it("preserva mensagem de erro/stack trace sem PII intactos", () => {
    const event = {
      exception: { values: [{ value: "TypeError: Cannot read property 'x' of undefined", stacktrace: { frames: [{ filename: "lib/ai.ts", lineno: 42 }] } }] },
    };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.exception.values[0].value).toBe("TypeError: Cannot read property 'x' of undefined");
    expect(result.exception.values[0].stacktrace.frames[0].filename).toBe("lib/ai.ts");
  });

  it("percorre arrays sem quebrar", () => {
    const event = { breadcrumbs: [{ message: "telefone +5511999998888 falhou" }, { message: "ok" }] };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.breadcrumbs[0].message).not.toContain("+5511999998888");
    expect(result.breadcrumbs[1].message).toBe("ok");
  });

  it("não quebra com null, undefined, número ou boolean", () => {
    const event = { extra: { a: null, b: undefined, c: 42, d: true } };
    expect(() => scrubSentryEvent(event)).not.toThrow();
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.extra.a).toBeNull();
    expect(result.extra.c).toBe(42);
    expect(result.extra.d).toBe(true);
  });

  it("chave PII é case-insensitive (ex: Nome_Completo, TELEFONE)", () => {
    const event = { extra: { Nome_Completo: "João", TELEFONE: "+5511999998888" } };
    const result = scrubSentryEvent(event) as typeof event;
    expect(result.extra.Nome_Completo).toBe("[removido]");
    expect(result.extra.TELEFONE).toBe("[removido]");
  });

  it("retorna objeto vazio inalterado", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });

  it("frase livre mista com CPF dentro do texto (não como campo isolado) é redigida", () => {
    const event = {
      exception: {
        values: [
          {
            value:
              "Erro ao validar lead: CPF 123.456.789-00 já cadastrado, telefone +5511999998888 duplicado",
          },
        ],
      },
    };
    const result = scrubSentryEvent(event) as typeof event;
    const msg = result.exception.values[0].value;
    expect(msg).not.toContain("123.456.789-00");
    expect(msg).not.toContain("+5511999998888");
    expect(msg).toContain("[cpf removido]");
    expect(msg).toContain("[telefone removido]");
  });

  it("CPF/telefone dentro de campo genérico não-PII (message, context_line, vars) é redigido pelo regex mesmo sem chave conhecida", () => {
    const event = {
      // "context_line"/"vars" não estão em PII_KEYS — só o regex protege aqui
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  context_line: "// debug: cliente João, cpf 123.456.789-00, tel +5511999998888",
                  vars: { anyLocalVar: "contato +5511999998888" },
                },
              ],
            },
          },
        ],
      },
      message: "falha pro lead com CPF 123.456.789-00",
    };
    const result = scrubSentryEvent(event) as typeof event;
    const frame = result.exception.values[0].stacktrace.frames[0];
    expect(frame.context_line).not.toContain("123.456.789-00");
    expect(frame.context_line).not.toContain("+5511999998888");
    expect(frame.vars.anyLocalVar).not.toContain("+5511999998888");
    expect(result.message).not.toContain("123.456.789-00");
  });
});
