import { describe, it, expect } from "vitest";
import { buildLeadDossier, type DossierInput } from "@/lib/lead-dossier";
import { relativeTime } from "@/lib/format";

function makeInput(overrides: Partial<DossierInput> = {}): DossierInput {
  return {
    lead: { id: "lead-1", nome: "Maria", lead_status: "ENGAJADO", score: 50 },
    conversation: {
      summary: "Lead interessada em SUV",
      ultima_mensagem_em: "2025-01-15T12:00:00Z",
      conversation_status: "ATIVA",
    },
    scoreEvents: [],
    followUpLogs: [],
    reactivationLogs: [],
    ...overrides,
  };
}

describe("buildLeadDossier — intent_signals", () => {
  it("T1: sem score_events → intent_signals = []", () => {
    const r = buildLeadDossier(makeInput({ scoreEvents: [] }));
    expect(r.intent_signals).toEqual([]);
  });

  it("T2: 3 score_events com reasons duplicadas → intent_signals dedup correto", () => {
    const r = buildLeadDossier(
      makeInput({
        scoreEvents: [
          { delta: 10, reasons: ["interesse_suv", "perguntou_preco"], created_at: "2025-01-15T10:00:00Z" },
          { delta: 5,  reasons: ["interesse_suv", "comparou_modelos"],  created_at: "2025-01-15T11:00:00Z" },
          { delta: 8,  reasons: ["comparou_modelos"],                   created_at: "2025-01-15T12:00:00Z" },
        ],
      })
    );
    expect(r.intent_signals).toEqual(["interesse_suv", "perguntou_preco", "comparou_modelos"]);
    expect(r.intent_signals.length).toBe(3);
  });
});

describe("buildLeadDossier — warnings (follow_up)", () => {
  it("T3: 2x sent + 1x failed → '2 follow-up(s) enviado(s) sem resposta' (failed não conta)", () => {
    const r = buildLeadDossier(
      makeInput({
        followUpLogs: [
          { attempt_number: 1, status: "sent" },
          { attempt_number: 2, status: "sent" },
          { attempt_number: 3, status: "failed" },
        ],
      })
    );
    expect(r.warnings).toContain("2 follow-up(s) enviado(s) sem resposta");
    expect(r.warningSeverity).toBe("moderate");
  });

  it("T3b: follow_up attempt=3 sent → '3 follow-up(s)...' + severity critical", () => {
    const r = buildLeadDossier(
      makeInput({
        followUpLogs: [
          { attempt_number: 1, status: "sent" },
          { attempt_number: 2, status: "sent" },
          { attempt_number: 3, status: "sent" },
        ],
      })
    );
    expect(r.warnings).toContain("3 follow-up(s) enviado(s) sem resposta");
    expect(r.warningSeverity).toBe("critical");
  });
});

describe("buildLeadDossier — warnings (reactivation)", () => {
  it("T4: reactivation 1x sent → 'reativação tentada 1x'", () => {
    const r = buildLeadDossier(
      makeInput({
        reactivationLogs: [{ attempt_number: 1, status: "sent" }],
      })
    );
    expect(r.warnings).toContain("reativação tentada 1x");
    expect(r.warningSeverity).toBe("moderate");
  });

  it("T4b: reactivation 2x sent (máx) → 'reativação tentada 2x' + severity critical", () => {
    const r = buildLeadDossier(
      makeInput({
        reactivationLogs: [
          { attempt_number: 1, status: "sent" },
          { attempt_number: 2, status: "sent" },
        ],
      })
    );
    expect(r.warnings).toContain("reativação tentada 2x");
    expect(r.warningSeverity).toBe("critical");
  });
});

describe("buildLeadDossier — warnings empty", () => {
  it("T5: sem logs → warnings = [], warningSeverity = null", () => {
    const r = buildLeadDossier(makeInput());
    expect(r.warnings).toEqual([]);
    expect(r.warningSeverity).toBeNull();
  });
});

describe("buildLeadDossier — priority via calculateLeadPriority", () => {
  it("T6: score >= 80 → priority = 'hot'", () => {
    const r = buildLeadDossier(
      makeInput({ lead: { id: "l", nome: "M", lead_status: "ENGAJADO", score: 85 } })
    );
    expect(r.priority).toBe("hot");
    expect(r.priority_label).toBe("Quente");
  });

  it("T7: conversation_status = AGUARDANDO_HUMANO + score 30 → priority = 'hot' via handoff", () => {
    const r = buildLeadDossier(
      makeInput({
        lead: { id: "l", nome: "M", lead_status: "ENGAJADO", score: 30 },
        conversation: {
          summary: null,
          ultima_mensagem_em: "2025-01-15T12:00:00Z",
          conversation_status: "AGUARDANDO_HUMANO",
        },
      })
    );
    expect(r.priority).toBe("hot");
    expect(r.priority_label).toBe("Quente");
  });

  it("T8: score < 40 → priority = 'cold', recent_activity usa relativeTime()", () => {
    const ts = "2025-01-15T12:00:00Z";
    const r = buildLeadDossier(
      makeInput({
        lead: { id: "l", nome: "M", lead_status: "NOVO", score: 20 },
        conversation: { summary: null, ultima_mensagem_em: ts, conversation_status: "ATIVA" },
      })
    );
    expect(r.priority).toBe("cold");
    expect(r.recent_activity).toBe(relativeTime(ts));
  });
});

describe("buildLeadDossier — nulls e defaults", () => {
  it("T9: nome = null → lead_name = 'Sem nome'", () => {
    const r = buildLeadDossier(
      makeInput({ lead: { id: "l", nome: null, lead_status: "NOVO", score: 50 } })
    );
    expect(r.lead_name).toBe("Sem nome");
  });

  it("T10: summary = null → summary = 'Primeiro contato'", () => {
    const r = buildLeadDossier(
      makeInput({
        conversation: {
          summary: null,
          ultima_mensagem_em: "2025-01-15T12:00:00Z",
          conversation_status: "ATIVA",
        },
      })
    );
    expect(r.summary).toBe("Primeiro contato");
  });
});
