import { describe, it, expect } from "vitest";
import { validateOutput, AgentOutputError } from "@/lib/ai";

describe("validateOutput", () => {
  const base = {
    reply_text: "Olá! Posso ajudar com informações sobre nossos veículos.",
    should_handoff: false,
    score: 50,
    intent_tags: ["interesse_suv"],
    summary: "Lead quer SUV",
  };

  it("retorna AgentResult válido com dados corretos", () => {
    const result = validateOutput(base, 0);
    expect(result.reply_text).toBe("Olá! Posso ajudar com informações sobre nossos veículos.");
    expect(result.should_handoff).toBe(false);
    expect(result.score).toBe(50);
    expect(result.intent_tags).toEqual(["interesse_suv"]);
    expect(result.summary).toBe("Lead quer SUV");
  });

  it("reply_text vazio lança AgentOutputError (fatal)", () => {
    expect(() => validateOutput({ ...base, reply_text: "" }, 0)).toThrow(AgentOutputError);
  });

  it("reply_text ausente lança AgentOutputError (fatal)", () => {
    const { reply_text: _, ...rest } = base;
    expect(() => validateOutput(rest, 0)).toThrow(AgentOutputError);
  });

  it("should_handoff não-boolean → fallback false", () => {
    const result = validateOutput({ ...base, should_handoff: "sim" }, 0);
    expect(result.should_handoff).toBe(false);
  });

  it("score < 0 → fallback para leadScore", () => {
    const result = validateOutput({ ...base, score: -5 }, 40);
    expect(result.score).toBe(40);
  });

  it("score > 100 → fallback para leadScore", () => {
    const result = validateOutput({ ...base, score: 150 }, 25);
    expect(result.score).toBe(25);
  });

  it("intent_tags não-array → fallback []", () => {
    const result = validateOutput({ ...base, intent_tags: "interesse" }, 0);
    expect(result.intent_tags).toEqual([]);
  });

  it("intent_tags ausente → fallback []", () => {
    const { intent_tags: _, ...rest } = base;
    const result = validateOutput(rest, 0);
    expect(result.intent_tags).toEqual([]);
  });

  it("summary ausente → fallback ''", () => {
    const { summary: _, ...rest } = base;
    const result = validateOutput(rest, 0);
    expect(result.summary).toBe("");
  });

  it("raw nulo lança AgentOutputError", () => {
    expect(() => validateOutput(null, 0)).toThrow(AgentOutputError);
  });
});

describe("validateOutput — collected_data", () => {
  const base = {
    reply_text: "Olá! Posso ajudar com informações sobre nossos veículos.",
    should_handoff: false,
    score: 50,
    intent_tags: ["interesse_suv"],
    summary: "Lead quer SUV",
  };

  it("collected_data ausente → resultado sem a chave collected_data", () => {
    const result = validateOutput(base, 0);
    expect(result.collected_data).toBeUndefined();
  });

  it("collected_data.financiamento válido é extraído com todos os campos", () => {
    const raw = {
      ...base,
      collected_data: {
        financiamento: {
          nome_completo: "João Silva",
          cpf: "123.456.789-00",
          renda_aproximada: "3000",
          entrada_disposta: "2000",
          data_nascimento: "1990-05-20",
        },
      },
    };
    const result = validateOutput(raw, 0);
    expect(result.collected_data?.financiamento).toEqual({
      nome_completo: "João Silva",
      cpf: "123.456.789-00",
      renda_aproximada: "3000",
      entrada_disposta: "2000",
      data_nascimento: "1990-05-20",
    });
  });

  it("collected_data.financiamento sem data_nascimento → campo vem null", () => {
    const raw = {
      ...base,
      collected_data: {
        financiamento: {
          nome_completo: "João Silva",
          cpf: null,
          renda_aproximada: null,
          entrada_disposta: null,
        },
      },
    };
    const result = validateOutput(raw, 0);
    expect(result.collected_data?.financiamento?.data_nascimento).toBeNull();
  });

  it("collected_data.troca parcial preenche campos ausentes com null", () => {
    const raw = {
      ...base,
      collected_data: { troca: { modelo: "Bros 160", ano: 2019 } },
    };
    const result = validateOutput(raw, 0);
    expect(result.collected_data?.troca).toEqual({
      modelo: "Bros 160",
      ano: 2019,
      km: null,
      servico_recente: null,
      agendamento_data: null,
      agendamento_horario: null,
    });
  });

  it("collected_data malformado (string em vez de objeto) não lança erro e resulta undefined", () => {
    const raw = { ...base, collected_data: "não sei" };
    expect(() => validateOutput(raw, 0)).not.toThrow();
    const result = validateOutput(raw, 0);
    expect(result.collected_data).toBeUndefined();
  });

  it("collected_data com financiamento e troca ambos null → collected_data undefined", () => {
    const raw = { ...base, collected_data: { financiamento: null, troca: null } };
    const result = validateOutput(raw, 0);
    expect(result.collected_data).toBeUndefined();
  });
});
