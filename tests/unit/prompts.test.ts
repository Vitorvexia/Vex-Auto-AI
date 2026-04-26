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
      { id: "v1", marca: "Hyundai", modelo: "HB20", ano: 2022, preco: 74900 },
      { id: "v2", marca: "Jeep", modelo: "Renegade", ano: 2022, preco: 99900 },
    ],
    incoming_text: "Quero ver SUVs disponíveis",
    ...overrides,
  };
}

const guardrailNormal: GuardrailResult = { mode: "normal", reason: "padrão" };

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
    const { system } = buildPrompt(makeCtx(), { mode: "off_hours", reason: "tarde" });
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
});
