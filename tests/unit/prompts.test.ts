import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/lib/prompts";
import type { AgentContext } from "@/lib/agent-context";
import type { GuardrailResult } from "@/lib/guardrails";

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    store_id: "store-1",
    store_name: "Vex Motors Teste",
    lead: {
      id: "lead-1",
      nome: "Maria",
      phone_normalized: "+5511999999999",
      lead_status: "ENGAJADO",
      score: 30,
      origem: "whatsapp",
      contexto: {},
    },
    conversation: {
      id: "conv-1",
      conversation_status: "ATIVA",
      handoff_to: "IA",
      summary: "Lead interessada em SUV",
      ultima_mensagem_em: new Date().toISOString(),
    },
    last_messages: [
      { direcao: "entrada", autor: "lead", mensagem: "Olá", received_at: new Date().toISOString() },
      { direcao: "saida", autor: "ia", mensagem: "Olá! Como posso ajudar?", received_at: new Date().toISOString() },
    ],
    vehicles: [
      { id: "v1", marca: "Hyundai", modelo: "HB20", ano: 2022, preco: 74900, custo: 65000, margem_minima: 3000 },
      { id: "v2", marca: "Jeep", modelo: "Renegade", ano: 2022, preco: 99900, custo: 88000, margem_minima: 4000 },
    ],
    incoming_text: "Quero ver SUVs disponíveis",
    ...overrides,
  };
}

const guardrailNormal: GuardrailResult = { mode: "normal", reason: "padrão", collection: null };

describe("buildPrompt", () => {
  it("system contém nome da store", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("Vex Motors Teste");
  });

  it("system contém seção [TOM DE VOZ]", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("[TOM DE VOZ]");
  });

  it("system contém dados do lead (nome, status, score)", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("Maria");
    expect(system).toContain("ENGAJADO");
    expect(system).toContain("30/100");
  });

  it("system contém summary da conversa", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("Lead interessada em SUV");
  });

  it("summary null → texto padrão de primeiro contato", () => {
    const ctx = makeCtx({
      conversation: { ...makeCtx().conversation, summary: null },
    });
    const { system } = buildPrompt(ctx, guardrailNormal);
    expect(system).toContain("Primeiro contato");
  });

  it("catálogo contém veículos formatados", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("Hyundai HB20 2022");
    expect(system).toContain("74.900");
  });

  it("catálogo limitado a 6 veículos mesmo com mais no contexto", () => {
    const vehicles = Array.from({ length: 10 }, (_, i) => ({
      id: `v${i}`,
      marca: "Marca",
      modelo: `Modelo${i}`,
      ano: 2022,
      preco: 50000 + i * 1000,
      custo: 43000 + i * 800,
      margem_minima: 2000,
    }));
    const { system } = buildPrompt(makeCtx({ vehicles }), guardrailNormal);
    const matches = system.match(/Marca Modelo\d+ 2022/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(6);
  });

  it("modo normal presente no system", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("[MODO ATUAL: normal]");
  });

  it("modo off_hours refletido no system", () => {
    const { system } = buildPrompt(makeCtx(), { mode: "off_hours", reason: "tarde", collection: null });
    expect(system).toContain("[MODO ATUAL: off_hours]");
  });

  it("formato JSON exigido no system", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("reply_text");
    expect(system).toContain("should_handoff");
    expect(system).toContain("intent_tags");
    expect(system).toContain("summary");
    expect(system).toContain("score");
  });

  it("messages[] mapeia histórico corretamente (entrada→user, saida→assistant)", () => {
    const { messages } = buildPrompt(makeCtx(), guardrailNormal);
    expect(messages[0]).toEqual({ role: "user", content: "Olá" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Olá! Como posso ajudar?" });
  });

  it("última mensagem em messages[] é a incoming_text", () => {
    const { messages } = buildPrompt(makeCtx(), guardrailNormal);
    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toBe("Quero ver SUVs disponíveis");
  });

  it("sem histórico: messages[] contém apenas incoming_text", () => {
    const ctx = makeCtx({ last_messages: [] });
    const { messages } = buildPrompt(ctx, guardrailNormal);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "Quero ver SUVs disponíveis" });
  });

  it("catálogo vazio mostra mensagem alternativa", () => {
    const ctx = makeCtx({ vehicles: [] });
    const { system } = buildPrompt(ctx, guardrailNormal);
    expect(system).toContain("Nenhum veículo disponível");
  });

  it("regras fixas proíbem preço abaixo da margem mínima", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("Nunca aceite, confirme ou sugira preço abaixo da margem mínima");
  });

  it("regras fixas instruem should_handoff=true para desconto que viola margem", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    const idx = system.indexOf("[REGRAS FIXAS]");
    expect(idx).toBeGreaterThan(-1);
    const rules = system.slice(idx);
    expect(rules).toContain("should_handoff=true");
    expect(rules).toContain("margem mínima");
  });
});

describe("buildPrompt — coleta de financiamento/troca", () => {
  it("sem collection: bloco [COLETA DE DADOS] não aparece", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).not.toContain("[COLETA DE DADOS]");
  });

  it("ask financiamento: instrui pergunta única com nome/CPF/renda/entrada", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: ["financiamento"], collect: [], missingTrocaFields: [] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("[COLETA DE DADOS]");
    expect(system).toContain("CPF");
    expect(system).toContain("entrada");
  });

  it("collect financiamento: instrui should_handoff=true e menciona collected_data", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("should_handoff=true");
    expect(system).toContain("collected_data");
  });

  it("ask troca: instrui pergunta única por vez, começando por modelo/ano", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: ["troca"], collect: [], missingTrocaFields: [] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("modelo");
  });

  it("collect troca: lista campos faltantes quando presentes", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["troca"], missingTrocaFields: ["quantos km rodados"] },
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("quantos km rodados");
  });

  it("json schema documenta collected_data", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("collected_data");
  });

  it("[DATA ATUAL] presente no system com a data injetada", () => {
    const fixedNow = new Date("2026-07-24T15:00:00.000Z");
    const { system } = buildPrompt(makeCtx(), guardrailNormal, fixedNow);
    expect(system).toContain("[DATA ATUAL]");
    expect(system).toContain("2026-07-24");
  });
});
