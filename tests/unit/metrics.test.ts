import { describe, it, expect } from "vitest";
import { calculateOperationalMetrics, countLeadsToday } from "@/lib/metrics";
import type { MetricsInput } from "@/lib/metrics";

function emptyInput(): MetricsInput {
  return { leads: [], conversations: [], messages: [], followUpLogs: [], reactivationLogs: [] };
}

function ts(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60000).toISOString();
}

// ---------------------------------------------------------------------------
// T1 — input vazio → zeros, sem NaN / Infinity
// ---------------------------------------------------------------------------

describe("calculateOperationalMetrics", () => {
  it("T1: input vazio → todas as métricas zero, sem NaN nem Infinity", () => {
    const m = calculateOperationalMetrics(emptyInput());
    for (const [key, val] of Object.entries(m)) {
      expect(Number.isFinite(val), `${key} deve ser finito`).toBe(true);
      expect(val, `${key} deve ser 0`).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // T2–T5 — contagens de leads
  // -------------------------------------------------------------------------

  it("T2: total_leads conta todos os leads do input", () => {
    const input = emptyInput();
    input.leads = [
      { lead_status: "NOVO",       created_at: ts(0) },
      { lead_status: "ENGAJADO",   created_at: ts(0) },
      { lead_status: "NEGOCIACAO", created_at: ts(0) },
    ];
    expect(calculateOperationalMetrics(input).total_leads).toBe(3);
  });

  it("T3: negotiation_leads conta apenas NEGOCIACAO", () => {
    const input = emptyInput();
    input.leads = [
      { lead_status: "NEGOCIACAO", created_at: ts(0) },
      { lead_status: "NEGOCIACAO", created_at: ts(0) },
      { lead_status: "FECHADO",    created_at: ts(0) },
    ];
    expect(calculateOperationalMetrics(input).negotiation_leads).toBe(2);
  });

  it("T4: closed_leads conta apenas FECHADO", () => {
    const input = emptyInput();
    input.leads = [
      { lead_status: "FECHADO", created_at: ts(0) },
      { lead_status: "NOVO",    created_at: ts(0) },
    ];
    expect(calculateOperationalMetrics(input).closed_leads).toBe(1);
  });

  it("T5: lost_leads conta apenas PERDIDO", () => {
    const input = emptyInput();
    input.leads = [
      { lead_status: "PERDIDO", created_at: ts(0) },
      { lead_status: "PERDIDO", created_at: ts(0) },
    ];
    expect(calculateOperationalMetrics(input).lost_leads).toBe(2);
  });

  // -------------------------------------------------------------------------
  // T6 — human_handoff_count via mensagens de sistema
  // -------------------------------------------------------------------------

  it("T6: human_handoff_count = número de mensagens sistema 'Conversa assumida por humano'", () => {
    const input = emptyInput();
    input.messages = [
      { conversation_id: "c1", direcao: "saida", autor: "sistema", received_at: ts(0), mensagem: "Conversa assumida por humano" },
      { conversation_id: "c2", direcao: "saida", autor: "sistema", received_at: ts(0), mensagem: "Conversa assumida por humano" },
      { conversation_id: "c3", direcao: "saida", autor: "sistema", received_at: ts(0), mensagem: "Conversa retornada para IA" },
      { conversation_id: "c4", direcao: "saida", autor: "ia",      received_at: ts(0) },
    ];
    expect(calculateOperationalMetrics(input).human_handoff_count).toBe(2);
  });

  // -------------------------------------------------------------------------
  // T7 — ai_handled_leads exclui conversas com handoff humano
  // -------------------------------------------------------------------------

  it("T7: ai_handled_leads conta leads em conversas IA sem histórico de handoff humano", () => {
    const input = emptyInput();
    input.conversations = [
      { id: "c1", handoff_to: "IA",     lead_id: "lead-a" }, // puro IA
      { id: "c2", handoff_to: "IA",     lead_id: "lead-b" }, // IA, mas teve handoff no histórico
      { id: "c3", handoff_to: "HUMANO", lead_id: "lead-c" }, // atualmente com humano
    ];
    input.messages = [
      { conversation_id: "c2", direcao: "saida", autor: "sistema", received_at: ts(-60), mensagem: "Conversa assumida por humano" },
    ];
    // lead-a: IA puro → conta. lead-b: teve handoff → não conta. lead-c: handoff_to=HUMANO → não conta
    expect(calculateOperationalMetrics(input).ai_handled_leads).toBe(1);
  });

  // -------------------------------------------------------------------------
  // T8–T9 — followups e reativações enviados
  // -------------------------------------------------------------------------

  it("T8: followups_sent conta apenas status=sent em follow_up_logs", () => {
    const input = emptyInput();
    input.followUpLogs = [
      { lead_id: "l1", status: "sent",   logged_at: ts(0), conversation_id: "c1" },
      { lead_id: "l2", status: "sent",   logged_at: ts(0), conversation_id: "c2" },
      { lead_id: "l3", status: "failed", logged_at: ts(0), conversation_id: "c3" },
    ];
    expect(calculateOperationalMetrics(input).followups_sent).toBe(2);
  });

  it("T9: reactivations_sent conta apenas status=sent em reactivation_logs", () => {
    const input = emptyInput();
    input.reactivationLogs = [
      { lead_id: "l1", status: "sent",   logged_at: ts(0), conversation_id: "c1" },
      { lead_id: "l2", status: "failed", logged_at: ts(0), conversation_id: "c2" },
    ];
    expect(calculateOperationalMetrics(input).reactivations_sent).toBe(1);
  });

  // -------------------------------------------------------------------------
  // T10 — avg_first_response_minutes
  // -------------------------------------------------------------------------

  it("T10: avg_first_response_minutes calcula tempo médio entre primeira entrada e primeira resposta IA", () => {
    const base = new Date("2024-01-01T10:00:00Z");
    const t = (min: number) => new Date(base.getTime() + min * 60000).toISOString();

    const input = emptyInput();
    input.messages = [
      // conversa 1: 3 minutos de resposta
      { conversation_id: "c1", direcao: "entrada", autor: "lead", received_at: t(0) },
      { conversation_id: "c1", direcao: "saida",   autor: "ia",   received_at: t(3) },
      // conversa 2: 7 minutos de resposta
      { conversation_id: "c2", direcao: "entrada", autor: "lead", received_at: t(0) },
      { conversation_id: "c2", direcao: "saida",   autor: "ia",   received_at: t(7) },
    ];
    // média = (3 + 7) / 2 = 5.0
    expect(calculateOperationalMetrics(input).avg_first_response_minutes).toBe(5);
  });

  // -------------------------------------------------------------------------
  // T11 — followup_response_rate com respostas parciais
  // -------------------------------------------------------------------------

  it("T11: followup_response_rate = fração de leads que responderam após followup", () => {
    const before = "2024-01-01T10:00:00Z";
    const after  = "2024-01-01T12:00:00Z";

    const input = emptyInput();
    input.followUpLogs = [
      { lead_id: "l1", status: "sent", logged_at: before, conversation_id: "c1" }, // vai responder
      { lead_id: "l2", status: "sent", logged_at: before, conversation_id: "c2" }, // não responde
    ];
    input.messages = [
      { conversation_id: "c1", direcao: "entrada", autor: "lead", received_at: after }, // resposta
    ];
    // 1 de 2 = 0.5
    expect(calculateOperationalMetrics(input).followup_response_rate).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // T12 — reactivation_response_rate com divisão por zero
  // -------------------------------------------------------------------------

  it("T12: reactivation_response_rate = 0 quando nenhuma reativação foi enviada (sem NaN)", () => {
    const input = emptyInput();
    input.reactivationLogs = [
      { lead_id: "l1", status: "failed", logged_at: "2024-01-01T10:00:00Z", conversation_id: "c1" },
    ];
    const result = calculateOperationalMetrics(input);
    expect(result.reactivation_response_rate).toBe(0);
    expect(Number.isFinite(result.reactivation_response_rate)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// countLeadsToday
// ---------------------------------------------------------------------------

describe("countLeadsToday", () => {
  it("T1: array vazio → 0", () => {
    expect(countLeadsToday([], new Date("2026-08-13T15:00:00Z"))).toBe(0);
  });

  it("T2: conta lead criado hoje mais cedo", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const leads = [{ created_at: "2026-08-13T09:00:00Z" }];
    expect(countLeadsToday(leads, now)).toBe(1);
  });

  it("T3: não conta lead criado ontem", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const leads = [{ created_at: "2026-08-12T23:00:00Z" }];
    expect(countLeadsToday(leads, now)).toBe(0);
  });

  it("T4: não conta lead criado amanhã (clock skew)", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const leads = [{ created_at: "2026-08-14T01:00:00Z" }];
    expect(countLeadsToday(leads, now)).toBe(0);
  });

  it("T5: conta só os de hoje numa lista mista", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const leads = [
      { created_at: "2026-08-13T00:00:01Z" }, // hoje, bem cedo
      { created_at: "2026-08-13T23:59:59Z" }, // hoje, bem tarde
      { created_at: "2026-08-12T23:59:59Z" }, // ontem
      { created_at: "2026-08-11T10:00:00Z" }, // dias atrás
    ];
    expect(countLeadsToday(leads, now)).toBe(2);
  });
});
