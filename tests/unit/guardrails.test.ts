import { describe, it, expect } from "vitest";
import { runGuardrails } from "@/lib/guardrails";
import type { AgentContext } from "@/lib/agent-context";

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    store_id: "store-1",
    store_name: "Vex Motors",
    lead: {
      id: "lead-1",
      nome: "João",
      phone_normalized: "+5511999999999",
      lead_status: "NOVO",
      score: 0,
      origem: "whatsapp",
      contexto: {},
    },
    conversation: {
      id: "conv-1",
      conversation_status: "ATIVA",
      handoff_to: "IA",
      handoff_topics: [],
      summary: null,
      ultima_mensagem_em: new Date().toISOString(),
    },
    last_messages: [],
    vehicles: [],
    incoming_text: "Quero saber sobre carros disponíveis",
    ...overrides,
  };
}

// 14h BRT (dentro do horário) — 17h UTC
const BUSINESS_NOW = new Date("2025-01-15T17:00:00.000Z");
// 20h BRT (fora do horário) — 23h UTC
const OFF_HOURS_NOW = new Date("2025-01-15T23:00:00.000Z");

describe("runGuardrails", () => {
  it("retorna normal em condições padrão dentro do horário", () => {
    const r = runGuardrails(makeCtx(), { now: BUSINESS_NOW });
    expect(r.mode).toBe("normal");
  });

  it("prioridade 1: conversa ENCERRADA => reopen (prevalece mesmo fora do horário)", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "ENCERRADA",
        handoff_to: "IA",
        handoff_topics: [],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
      incoming_text: "oi",
    });
    const r = runGuardrails(ctx, { now: OFF_HOURS_NOW });
    expect(r.mode).toBe("reopen");
  });

  it("prioridade 1: ENCERRADA prevalece sobre human_handoff", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "ENCERRADA",
        handoff_to: "HUMANO",
        handoff_topics: [],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("reopen");
  });

  it("prioridade 2: handoff_to HUMANO => human_handoff", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "ATIVA",
        handoff_to: "HUMANO",
        handoff_topics: [],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
  });

  it("prioridade 2: status AGUARDANDO_HUMANO => human_handoff", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "IA",
        handoff_topics: [],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
  });

  it("fora do horário comercial: IA continua respondendo normal — mode normal, não um modo 'fechado'", () => {
    const ctx = makeCtx({ incoming_text: "quanto custa esse carro?" });
    const r = runGuardrails(ctx, { now: OFF_HOURS_NOW });
    expect(r.mode).toBe("normal");
  });

  it("mensagem curta fora do horário ainda vira short_message (hora não interfere nesse gate)", () => {
    const ctx = makeCtx({ incoming_text: "oi" });
    const r = runGuardrails(ctx, { now: OFF_HOURS_NOW });
    expect(r.mode).toBe("short_message");
  });

  it("prioridade 3 (agora): mensagem curta dentro do horário => short_message", () => {
    const ctx = makeCtx({ incoming_text: "oi" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("short_message");
  });

  it("mensagem com exatamente 10 chars não é curta => normal", () => {
    const ctx = makeCtx({ incoming_text: "1234567890" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("normal");
  });

  it("reason nunca é vazio", () => {
    const r = runGuardrails(makeCtx(), { now: BUSINESS_NOW });
    expect(r.reason.length).toBeGreaterThan(0);
  });
});

describe("runGuardrails — outsideBusinessHours (campo ortogonal ao mode)", () => {
  it("dentro do horário: outsideBusinessHours=false", () => {
    const r = runGuardrails(makeCtx(), { now: BUSINESS_NOW });
    expect(r.outsideBusinessHours).toBe(false);
  });

  it("fora do horário: outsideBusinessHours=true, mesmo com mode normal", () => {
    const ctx = makeCtx({ incoming_text: "quanto custa esse carro?" });
    const r = runGuardrails(ctx, { now: OFF_HOURS_NOW });
    expect(r.outsideBusinessHours).toBe(true);
    expect(r.mode).toBe("normal");
  });

  it("horário configurável: start=9 marca 8h BRT como fora do horário", () => {
    // 11h UTC = 8h BRT
    const atHour8Brt = new Date("2025-01-15T11:00:00.000Z");
    const r = runGuardrails(makeCtx(), {
      businessHoursStart: 9,
      businessHoursEnd: 17,
      now: atHour8Brt,
    });
    expect(r.outsideBusinessHours).toBe(true);
    expect(r.mode).toBe("normal");
  });

  it("businessHoursStart e businessHoursEnd são expostos no resultado (pra frase de handoff/agendamento no prompt)", () => {
    const r = runGuardrails(makeCtx(), { now: OFF_HOURS_NOW, businessHoursStart: 9, businessHoursEnd: 17 });
    expect(r.businessHoursStart).toBe(9);
    expect(r.businessHoursEnd).toBe(17);
  });

  it("outsideBusinessHours=true também em ENCERRADA/human_handoff/reopen (campo sempre computado)", () => {
    const ctxHandoff = makeCtx({
      conversation: { id: "conv-1", conversation_status: "AGUARDANDO_HUMANO", handoff_to: "IA", handoff_topics: [], summary: null, ultima_mensagem_em: new Date().toISOString() },
    });
    const r = runGuardrails(ctxHandoff, { now: OFF_HOURS_NOW });
    expect(r.mode).toBe("human_handoff");
    expect(r.outsideBusinessHours).toBe(true);
  });
});

describe("collection — detecção de financiamento/troca", () => {
  it("mensagem nova sobre financiamento => collection.ask contém 'financiamento'", () => {
    const ctx = makeCtx({ incoming_text: "vocês têm financiamento?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.ask).toContain("financiamento");
    expect(r.collection?.collect).toEqual([]);
  });

  it("mensagem nova sobre troca => collection.ask contém 'troca'", () => {
    const ctx = makeCtx({ incoming_text: "aceita moto na troca?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.ask).toContain("troca");
  });

  it("pending_topics já contém 'financiamento' => collection.collect contém 'financiamento', ask vazio pro mesmo tópico", () => {
    const ctx = makeCtx({
      incoming_text: "meu nome é João, CPF 123, renda 3000, entrada 2000",
      lead: { ...makeCtx().lead, contexto: { pending_topics: ["financiamento"] } },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.collect).toContain("financiamento");
    expect(r.collection?.ask).not.toContain("financiamento");
  });

  it("sem sinal e sem pending_topics => collection é null", () => {
    const ctx = makeCtx({ incoming_text: "quero saber mais sobre o carro" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection).toBeNull();
  });

  it("modo human_handoff => collection sempre null", () => {
    const ctx = makeCtx({
      incoming_text: "vocês têm financiamento?",
      conversation: {
        id: "conv-1",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "HUMANO",
        handoff_topics: [],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
    expect(r.collection).toBeNull();
  });

  it("troca já coletada (contexto.troca preenchido) não reabre ask mesmo com sinal na mensagem", () => {
    const ctx = makeCtx({
      incoming_text: "e aquela troca que eu falei?",
      lead: {
        ...makeCtx().lead,
        contexto: {
          troca: {
            modelo: "Bros 160", ano: 2019, km: 20000,
            servico_recente: "não", agendamento_data: null, agendamento_horario: "sábado de manhã",
          },
        },
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.ask ?? []).not.toContain("troca");
  });

  it("collect de troca calcula missingTrocaFields a partir do draft parcial", () => {
    const ctx = makeCtx({
      incoming_text: "é uma Bros 160 2019",
      lead: {
        ...makeCtx().lead,
        contexto: { pending_topics: ["troca"], troca_draft: { modelo: null, ano: null } },
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.collection?.collect).toContain("troca");
    expect(r.collection?.missingTrocaFields.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Roadmap 1.11 — handoff parcial por assunto (preço/negociação)
//
// Caso real documentado em BL-0011 (2026-07-27): "tem desconto nela?" disparou
// handoff total; a pergunta seguinte, "tem quantas 160 no momento?" (estoque,
// sem relação com preço), ficou sem resposta porque o gate era incondicional.
// ---------------------------------------------------------------------------

describe("runGuardrails — handoff parcial por tópico (roadmap 1.11)", () => {
  function handoffCtx(overrides: Partial<AgentContext> = {}): AgentContext {
    return makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "HUMANO",
        handoff_topics: ["preco_negociacao"],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
      ...overrides,
    });
  }

  it("handoff legado (handoff_topics vazio) bloqueia tudo — comportamento preservado", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "HUMANO",
        handoff_topics: [],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
      incoming_text: "tem quantas 160 no momento?",
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
  });

  it("handoff parcial + mensagem sobre o tópico suspenso (preço) => continua human_handoff", () => {
    const ctx = handoffCtx({ incoming_text: "mas consegue baixar mais um pouco?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
  });

  it("caso real BL-0011: handoff parcial + 'tem quantas 160 no momento?' (estoque) => NÃO bloqueia, mode normal", () => {
    const ctx = handoffCtx({ incoming_text: "tem quantas 160 no momento?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).not.toBe("human_handoff");
    expect(r.mode).toBe("normal");
  });

  it("handoff parcial + mensagem fora do tópico continua computando collection normalmente", () => {
    const ctx = handoffCtx({ incoming_text: "vocês têm financiamento?" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("normal");
    expect(r.collection?.ask).toContain("financiamento");
  });

  it("handoff parcial + mensagem curta fora do tópico => short_message, não human_handoff", () => {
    const ctx = handoffCtx({ incoming_text: "oi" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("short_message");
  });

  it("AGUARDANDO_HUMANO com handoff_to=IA + handoff_topics preenchido também aplica gate condicional (não só handoff_to)", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "IA",
        handoff_topics: ["preco_negociacao"],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
      incoming_text: "tem quantas 160 no momento?",
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).not.toBe("human_handoff");
  });

  it("handoff parcial + ENCERRADA prevalece (prioridade máxima já testada, aqui só confirma que topics não interfere)", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "ENCERRADA",
        handoff_to: "HUMANO",
        handoff_topics: ["preco_negociacao"],
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
      incoming_text: "tem quantas 160 no momento?",
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("reopen");
  });
});
