import { describe, it, expect } from "vitest";
import { calculateOperationalMetrics, countLeadsToday, buildDailyTrend, countLeadsByStatus, calculateReactivationRevenue } from "@/lib/metrics";
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
      // avg_first_response_minutes é null (sem dado) com input vazio, não 0 —
      // ver T10b/T10c: 0 é resposta real, null é ausência de dado
      if (key === "avg_first_response_minutes") {
        expect(val, `${key} deve ser null (sem dado)`).toBeNull();
        continue;
      }
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

  it("T4b: revenue_generated soma valor_final apenas dos FECHADO", () => {
    const input = emptyInput();
    input.leads = [
      { lead_status: "FECHADO", created_at: ts(0), valor_final: 15000 },
      { lead_status: "FECHADO", created_at: ts(0), valor_final: 22000 },
      { lead_status: "NOVO",    created_at: ts(0), valor_final: 9000 },
    ];
    expect(calculateOperationalMetrics(input).revenue_generated).toBe(37000);
  });

  it("T4c: revenue_generated trata valor_final nulo/ausente como 0, sem NaN", () => {
    const input = emptyInput();
    input.leads = [
      { lead_status: "FECHADO", created_at: ts(0), valor_final: null },
      { lead_status: "FECHADO", created_at: ts(0) },
    ];
    const revenue = calculateOperationalMetrics(input).revenue_generated;
    expect(Number.isFinite(revenue)).toBe(true);
    expect(revenue).toBe(0);
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

  it("T10b: sem nenhum par entrada+resposta IA → null (sem dado), não 0", () => {
    const input = emptyInput();
    expect(calculateOperationalMetrics(input).avg_first_response_minutes).toBeNull();
  });

  it("T10c: resposta muito rápida arredonda pra 0 e continua sendo 0 (não null) — 0 é dado real, não ausência", () => {
    const base = new Date("2024-01-01T10:00:00Z");
    const t = (ms: number) => new Date(base.getTime() + ms).toISOString();

    const input = emptyInput();
    input.messages = [
      { conversation_id: "c1", direcao: "entrada", autor: "lead", received_at: t(0) },
      { conversation_id: "c1", direcao: "saida",   autor: "ia",   received_at: t(2000) }, // 2s
    ];
    expect(calculateOperationalMetrics(input).avg_first_response_minutes).toBe(0);
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

// ---------------------------------------------------------------------------
// buildDailyTrend
// ---------------------------------------------------------------------------

describe("buildDailyTrend", () => {
  it("T1: retorna `days` pontos, oldest → newest, terminando hoje", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const trend = buildDailyTrend([], [], [], 5, now);
    expect(trend.map((p) => p.date)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
  });

  it("T2: input vazio → todos os pontos zerados", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const trend = buildDailyTrend([], [], [], 3, now);
    for (const p of trend) {
      expect(p.novos).toBe(0);
      expect(p.followups).toBe(0);
      expect(p.reativacoes).toBe(0);
    }
  });

  it("T3: agrupa leads novos por dia UTC de created_at", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const leads = [
      { created_at: "2026-08-13T09:00:00Z" },
      { created_at: "2026-08-13T20:00:00Z" },
      { created_at: "2026-08-12T09:00:00Z" },
    ];
    const trend = buildDailyTrend(leads, [], [], 3, now);
    const byDate = Object.fromEntries(trend.map((p) => [p.date, p.novos]));
    expect(byDate["2026-08-13"]).toBe(2);
    expect(byDate["2026-08-12"]).toBe(1);
    expect(byDate["2026-08-11"]).toBe(0);
  });

  it("T4: conta só follow-ups/reativações com status 'sent'", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const followUpLogs = [
      { logged_at: "2026-08-13T09:00:00Z", status: "sent" },
      { logged_at: "2026-08-13T09:00:00Z", status: "failed" },
    ];
    const reactivationLogs = [
      { logged_at: "2026-08-13T09:00:00Z", status: "sent" },
      { logged_at: "2026-08-13T09:00:00Z", status: "sent" },
    ];
    const trend = buildDailyTrend([], followUpLogs, reactivationLogs, 1, now);
    expect(trend[0].followups).toBe(1);
    expect(trend[0].reativacoes).toBe(2);
  });

  it("T5: ignora registros fora da janela de `days`", () => {
    const now = new Date("2026-08-13T15:00:00Z");
    const leads = [{ created_at: "2026-08-01T09:00:00Z" }];
    const trend = buildDailyTrend(leads, [], [], 3, now);
    expect(trend.reduce((sum, p) => sum + p.novos, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countLeadsByStatus
// ---------------------------------------------------------------------------

describe("countLeadsByStatus", () => {
  it("T1: array vazio → todos os status zerados", () => {
    const counts = countLeadsByStatus([]);
    expect(counts).toEqual({
      NOVO: 0,
      ENGAJADO: 0,
      INTERESSADO: 0,
      QUENTE: 0,
      NEGOCIACAO: 0,
      FECHADO: 0,
      PERDIDO: 0,
    });
  });

  it("T2: conta leads por status", () => {
    const leads = [
      { lead_status: "NOVO" as const },
      { lead_status: "NOVO" as const },
      { lead_status: "FECHADO" as const },
      { lead_status: "PERDIDO" as const },
    ];
    const counts = countLeadsByStatus(leads);
    expect(counts.NOVO).toBe(2);
    expect(counts.FECHADO).toBe(1);
    expect(counts.PERDIDO).toBe(1);
    expect(counts.ENGAJADO).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateReactivationRevenue
// ---------------------------------------------------------------------------

describe("calculateReactivationRevenue", () => {
  it("T1: input vazio → zeros, sem NaN", () => {
    const result = calculateReactivationRevenue([], []);
    expect(result).toEqual({ converted_leads: 0, revenue: 0 });
  });

  it("T2: soma valor_final apenas dos leads com reativação convertida", () => {
    const leads = [
      { id: "l1", valor_final: 15000 },
      { id: "l2", valor_final: 8000 },
      { id: "l3", valor_final: 30000 },
    ];
    const reactivationLogs = [
      { lead_id: "l1", converted_at: "2026-08-01T10:00:00Z" },
      { lead_id: "l2", converted_at: null },
      { lead_id: "l3", converted_at: "2026-08-05T10:00:00Z" },
    ];
    const result = calculateReactivationRevenue(leads, reactivationLogs);
    expect(result.converted_leads).toBe(2);
    expect(result.revenue).toBe(45000);
  });

  it("T3: não duplica quando lead tem múltiplos logs convertidos (várias tentativas)", () => {
    const leads = [{ id: "l1", valor_final: 15000 }];
    const reactivationLogs = [
      { lead_id: "l1", converted_at: "2026-08-01T10:00:00Z" },
      { lead_id: "l1", converted_at: "2026-08-01T10:00:01Z" },
    ];
    const result = calculateReactivationRevenue(leads, reactivationLogs);
    expect(result.converted_leads).toBe(1);
    expect(result.revenue).toBe(15000);
  });

  it("T4: valor_final nulo/ausente vira 0, sem NaN", () => {
    const leads = [{ id: "l1", valor_final: null }];
    const reactivationLogs = [{ lead_id: "l1", converted_at: "2026-08-01T10:00:00Z" }];
    const result = calculateReactivationRevenue(leads, reactivationLogs);
    expect(Number.isFinite(result.revenue)).toBe(true);
    expect(result.revenue).toBe(0);
  });

  it("T5: lead convertido sem correspondência em `leads` não quebra (revenue 0 pra ele)", () => {
    const leads: Array<{ id: string; valor_final: number | null }> = [];
    const reactivationLogs = [{ lead_id: "l1", converted_at: "2026-08-01T10:00:00Z" }];
    const result = calculateReactivationRevenue(leads, reactivationLogs);
    expect(result.converted_leads).toBe(1);
    expect(result.revenue).toBe(0);
  });
});
