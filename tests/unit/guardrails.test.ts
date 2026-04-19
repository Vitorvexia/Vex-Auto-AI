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
    },
    conversation: {
      id: "conv-1",
      conversation_status: "ATIVA",
      handoff_to: "IA",
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

  it("prioridade 1: conversa ENCERRADA => reopen (prevalece sobre off_hours)", () => {
    const ctx = makeCtx({
      conversation: {
        id: "conv-1",
        conversation_status: "ENCERRADA",
        handoff_to: "IA",
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
        summary: null,
        ultima_mensagem_em: new Date().toISOString(),
      },
    });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("human_handoff");
  });

  it("prioridade 3: fora do horário => off_hours (engloba mensagem curta)", () => {
    const ctx = makeCtx({ incoming_text: "oi" });
    const r = runGuardrails(ctx, { now: OFF_HOURS_NOW });
    expect(r.mode).toBe("off_hours");
  });

  it("prioridade 4: mensagem curta dentro do horário => short_message", () => {
    const ctx = makeCtx({ incoming_text: "oi" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("short_message");
  });

  it("mensagem com exatamente 10 chars não é curta => normal", () => {
    const ctx = makeCtx({ incoming_text: "1234567890" });
    const r = runGuardrails(ctx, { now: BUSINESS_NOW });
    expect(r.mode).toBe("normal");
  });

  it("horário configurável: start=9 exclui hora 8 BRT", () => {
    // 11h UTC = 8h BRT
    const atHour8Brt = new Date("2025-01-15T11:00:00.000Z");
    const r = runGuardrails(makeCtx(), {
      businessHoursStart: 9,
      businessHoursEnd: 17,
      now: atHour8Brt,
    });
    expect(r.mode).toBe("off_hours");
  });

  it("reason nunca é vazio", () => {
    const r = runGuardrails(makeCtx(), { now: BUSINESS_NOW });
    expect(r.reason.length).toBeGreaterThan(0);
  });
});
