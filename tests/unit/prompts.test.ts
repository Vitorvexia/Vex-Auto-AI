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
      handoff_topics: [],
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

function makeGuardrail(overrides: Partial<GuardrailResult> = {}): GuardrailResult {
  return {
    mode: "normal",
    reason: "padrão",
    collection: null,
    outsideBusinessHours: false,
    businessHoursStart: 8,
    businessHoursEnd: 18,
    ...overrides,
  };
}

const guardrailNormal: GuardrailResult = makeGuardrail();

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

  it("formato JSON exigido no system", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).toContain("reply_texts");
    expect(system).toContain("should_handoff");
    expect(system).toContain("intent_tags");
    expect(system).toContain("summary");
    expect(system).toContain("score");
  });

  it("schema de reply_texts é array, não string única", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    const idx = system.indexOf('"reply_texts"');
    expect(idx).toBeGreaterThan(-1);
    // Logo depois da chave, o próximo caractere não-espaço deve ser '[' (array)
    const afterKey = system.slice(idx + '"reply_texts"'.length).trimStart();
    expect(afterKey.startsWith(":")).toBe(true);
    expect(afterKey.replace(/^:\s*/, "").startsWith("[")).toBe(true);
  });

  it("[TOM DE VOZ] instrui bolhas separadas via itens do array, não quebra de linha dentro de uma string", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    const idx = system.indexOf("[TOM DE VOZ]");
    expect(idx).toBeGreaterThan(-1);
    const tomDeVoz = system.slice(idx, system.indexOf("[DATA ATUAL]"));
    expect(tomDeVoz).toContain("reply_texts");
    expect(tomDeVoz).not.toContain("linha em branco");
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
      outsideBusinessHours: false, businessHoursStart: 8, businessHoursEnd: 18,
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("[COLETA DE DADOS]");
    expect(system).toContain("CPF");
    expect(system).toContain("entrada");
  });

  it("ask financiamento: pergunta única inclui data de nascimento", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: ["financiamento"], collect: [], missingTrocaFields: [] },
      outsideBusinessHours: false, businessHoursStart: 8, businessHoursEnd: 18,
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("nascimento");
  });

  it("collect financiamento: instrui should_handoff=true e menciona collected_data", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
      outsideBusinessHours: false, businessHoursStart: 8, businessHoursEnd: 18,
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("should_handoff=true");
    expect(system).toContain("collected_data");
  });

  it("collect financiamento: instrui extração de data_nascimento e troca de titular se menor de idade", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["financiamento"], missingTrocaFields: [] },
      outsideBusinessHours: false, businessHoursStart: 8, businessHoursEnd: 18,
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("data_nascimento");
    expect(system).toContain("menor de idade");
    expect(system).toContain("responsável");
    expect(system).toContain("nome completo, CPF, renda aproximada e entrada dela");
  });

  it("ask troca: instrui pergunta única por vez, começando por modelo/ano", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: ["troca"], collect: [], missingTrocaFields: [] },
      outsideBusinessHours: false, businessHoursStart: 8, businessHoursEnd: 18,
    };
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("modelo");
  });

  it("collect troca: lista campos faltantes quando presentes", () => {
    const guardrail: GuardrailResult = {
      mode: "normal", reason: "padrão",
      collection: { ask: [], collect: ["troca"], missingTrocaFields: ["quantos km rodados"] },
      outsideBusinessHours: false, businessHoursStart: 8, businessHoursEnd: 18,
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

describe("buildPrompt — fora do horário comercial (bugfix 24/7, 2026-07-30)", () => {
  it("dentro do horário: nenhuma instrução de handoff-fora-do-horário aparece", () => {
    const { system } = buildPrompt(makeCtx(), makeGuardrail({ outsideBusinessHours: false }));
    expect(system).not.toContain("horário de atendimento presencial");
  });

  it("fora do horário: instrui a IA a nunca soar como fechada e a atender normalmente", () => {
    const { system } = buildPrompt(makeCtx(), makeGuardrail({ outsideBusinessHours: true, businessHoursStart: 9 }));
    expect(system).toMatch(/continue (respondendo|atendendo) normalmente/i);
  });

  it("fora do horário: instrui que, em handoff real, quem retoma é o vendedor humano (não a IA)", () => {
    const { system } = buildPrompt(makeCtx(), makeGuardrail({ outsideBusinessHours: true, businessHoursStart: 9 }));
    expect(system).toContain("vendedor");
    expect(system).toMatch(/9h/);
  });

  it("modo human_handoff fora do horário também recebe a instrução (mode não filtra isso)", () => {
    const { system } = buildPrompt(
      makeCtx(),
      makeGuardrail({ mode: "human_handoff", outsideBusinessHours: true, businessHoursStart: 9 })
    );
    expect(system).toContain("vendedor");
  });

  it("fora do horário: reforça formato JSON estrito, dentro da própria seção (bugfix silêncio 8h30, 2026-07-31 — taxa de parse_error subiu de 7,6% pra 67% em produção depois dessa seção existir sem esse reforço)", () => {
    const { system } = buildPrompt(makeCtx(), makeGuardrail({ outsideBusinessHours: true, businessHoursStart: 9 }));
    const idx = system.indexOf("[FORA DO HORÁRIO DE ATENDIMENTO PRESENCIAL]");
    expect(idx).toBeGreaterThan(-1);
    const nextSectionIdx = system.indexOf("[FORMATO DE RESPOSTA]");
    const offHoursSection = system.slice(idx, nextSectionIdx);
    expect(offHoursSection).toMatch(/JSON/);
    expect(offHoursSection).toMatch(/nunca|sempre/i);
  });
});

describe("buildPrompt — agendamento presencial respeita horário configurado (bugfix 24/7, 2026-07-30)", () => {
  it("coleta de troca ativa (ask ou collect) menciona a janela de horário presencial configurada", () => {
    const guardrail = makeGuardrail({
      collection: { ask: ["troca"], collect: [], missingTrocaFields: [] },
      businessHoursStart: 9,
    });
    const { system } = buildPrompt(makeCtx(), guardrail);
    expect(system).toContain("9h");
    expect(system).toMatch(/horário de atendimento presencial/i);
  });

  it("sem coleta de troca ativa: nenhuma menção à janela de horário presencial", () => {
    const { system } = buildPrompt(makeCtx(), guardrailNormal);
    expect(system).not.toMatch(/horário de atendimento presencial/i);
  });

  it("instrui a orientar outro horário sem soar como recusa geral de atendimento", () => {
    const guardrail = makeGuardrail({
      collection: { ask: [], collect: ["troca"], missingTrocaFields: [] },
      businessHoursStart: 9,
      businessHoursEnd: 18,
    });
    const { system } = buildPrompt(makeCtx(), guardrail);
    const idx = system.indexOf("[COLETA DE DADOS]");
    const collectionSection = system.slice(idx, idx + 1500);
    expect(collectionSection).toMatch(/fora dess[ae] faixa|fora do horário/i);
    expect(collectionSection).toMatch(/escolh|outro horário/i);
  });
});
