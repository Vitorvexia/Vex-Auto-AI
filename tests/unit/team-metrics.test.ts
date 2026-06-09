import { describe, it, expect } from "vitest";
import {
  calculateTeamPageData,
  calculateTeamKpis,
  buildTeamAlerts,
  formatInactiveDuration,
  type SellerUser,
} from "@/lib/team-metrics";
import type { Lead } from "@/types/domain";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-09T12:00:00.000Z").getTime();

function ts(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * 60 * 60 * 1000).toISOString();
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    nome: null,
    phone_normalized: "",
    score: 50,
    lead_status: "NOVO",
    assigned_to: null,
    updated_at: ts(1),
    ...overrides,
  };
}

function makeUser(overrides: Partial<SellerUser> = {}): SellerUser {
  return { id: "u1", nome: "João Silva", role: "vendedor", ...overrides };
}

// ─── calculateTeamPageData ───────────────────────────────────────────────────

describe("calculateTeamPageData", () => {
  it("retorna array vazio quando não há usuários", () => {
    const result = calculateTeamPageData([], [], NOW);
    expect(result).toEqual([]);
  });

  it("vendedor sem leads: status no_leads, métricas zero", () => {
    const [s] = calculateTeamPageData([], [makeUser()], NOW);
    expect(s.status).toBe("no_leads");
    expect(s.total_leads).toBe(0);
    expect(s.hot_leads).toBe(0);
    expect(s.closed_leads).toBe(0);
    expect(s.conversion_pct).toBe(0);
    expect(s.last_activity_at).toBeNull();
    expect(s.inactive_duration_ms).toBeNull();
  });

  it("conversion_pct = 0 quando total_leads = 0 (sem divisão por zero)", () => {
    const [s] = calculateTeamPageData([], [makeUser()], NOW);
    expect(Number.isFinite(s.conversion_pct)).toBe(true);
    expect(s.conversion_pct).toBe(0);
  });

  it("cálculo de conversão correto", () => {
    const users = [makeUser()];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", lead_status: "FECHADO" }),
      makeLead({ id: "l2", assigned_to: "u1", lead_status: "NOVO" }),
      makeLead({ id: "l3", assigned_to: "u1", lead_status: "NOVO" }),
      makeLead({ id: "l4", assigned_to: "u1", lead_status: "FECHADO" }),
    ];
    const [s] = calculateTeamPageData(leads, users, NOW);
    // 2 fechados / 4 total = 50%
    expect(s.conversion_pct).toBe(50);
    expect(s.closed_leads).toBe(2);
  });

  it("status = attending quando vendedor tem lead AGUARDANDO_HUMANO", () => {
    const [s] = calculateTeamPageData(
      [makeLead({ assigned_to: "u1", conversation_status: "AGUARDANDO_HUMANO" })],
      [makeUser()],
      NOW
    );
    expect(s.status).toBe("attending");
    expect(s.awaiting_human_count).toBe(1);
  });

  it("status = inactive quando última atividade > 2h", () => {
    const [s] = calculateTeamPageData(
      [makeLead({ assigned_to: "u1", updated_at: ts(3) })],
      [makeUser()],
      NOW
    );
    expect(s.status).toBe("inactive");
  });

  it("status = active quando última atividade <= 2h", () => {
    const [s] = calculateTeamPageData(
      [makeLead({ assigned_to: "u1", updated_at: ts(1) })],
      [makeUser()],
      NOW
    );
    expect(s.status).toBe("active");
  });

  it("attending tem prioridade sobre inactive (AGUARDANDO_HUMANO + atualizado há 5h)", () => {
    const [s] = calculateTeamPageData(
      [
        makeLead({
          assigned_to: "u1",
          conversation_status: "AGUARDANDO_HUMANO",
          updated_at: ts(5),
        }),
      ],
      [makeUser()],
      NOW
    );
    expect(s.status).toBe("attending");
  });

  it("last_activity_at = max updated_at entre todos os leads atribuídos", () => {
    const users = [makeUser()];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", updated_at: ts(5) }),
      makeLead({ id: "l2", assigned_to: "u1", updated_at: ts(1) }),
      makeLead({ id: "l3", assigned_to: "u1", updated_at: ts(10) }),
    ];
    const [s] = calculateTeamPageData(leads, users, NOW);
    expect(s.last_activity_at).toBe(ts(1)); // mais recente = 1h atrás
  });

  it("hot_leads_stale_4h conta leads quentes (score>=80) sem update há >4h", () => {
    const users = [makeUser()];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", score: 90, updated_at: ts(5) }), // hot + stale
      makeLead({ id: "l2", assigned_to: "u1", score: 90, updated_at: ts(2) }), // hot, not stale
      makeLead({ id: "l3", assigned_to: "u1", score: 50, updated_at: ts(5) }), // not hot
    ];
    const [s] = calculateTeamPageData(leads, users, NOW);
    expect(s.hot_leads_stale_4h).toBe(1);
  });

  it("hot_leads_stale_4h conta leads via handoff (AGUARDANDO_HUMANO) sem update há >4h", () => {
    const users = [makeUser()];
    const leads = [
      makeLead({
        id: "l1",
        assigned_to: "u1",
        score: 30,
        conversation_status: "AGUARDANDO_HUMANO",
        updated_at: ts(5),
      }),
    ];
    const [s] = calculateTeamPageData(leads, users, NOW);
    expect(s.hot_leads_stale_4h).toBe(1);
  });

  it("segrega métricas entre múltiplos vendedores sem contaminação", () => {
    const users = [
      makeUser({ id: "u1", nome: "Alice" }),
      makeUser({ id: "u2", nome: "Bob" }),
    ];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", score: 90, lead_status: "NOVO" }),
      makeLead({ id: "l2", assigned_to: "u2", score: 40, lead_status: "FECHADO" }),
      makeLead({ id: "l3", assigned_to: "u1", lead_status: "FECHADO" }),
    ];
    const result = calculateTeamPageData(leads, users, NOW);
    const alice = result.find((r) => r.userId === "u1")!;
    const bob   = result.find((r) => r.userId === "u2")!;

    expect(alice.total_leads).toBe(2);
    expect(alice.hot_leads).toBe(1);
    expect(alice.closed_leads).toBe(1);

    expect(bob.total_leads).toBe(1);
    expect(bob.hot_leads).toBe(0);
    expect(bob.closed_leads).toBe(1);
  });

  it("initials derivado de nome corretamente", () => {
    const [s] = calculateTeamPageData([], [makeUser({ nome: "João Silva" })], NOW);
    expect(s.initials).toBe("JS");
  });

  it("initials de nome com uma palavra", () => {
    const [s] = calculateTeamPageData([], [makeUser({ nome: "João" })], NOW);
    expect(s.initials).toBe("J");
  });

  it("não inclui leads de outro vendedor na contagem", () => {
    const users = [makeUser({ id: "u1" })];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u2", score: 90, lead_status: "NOVO" }),
    ];
    const [s] = calculateTeamPageData(leads, users, NOW);
    expect(s.total_leads).toBe(0);
    expect(s.hot_leads).toBe(0);
  });

  it("inclui leads FECHADO na contagem total (não filtra por status)", () => {
    const users = [makeUser()];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", lead_status: "FECHADO" }),
      makeLead({ id: "l2", assigned_to: "u1", lead_status: "PERDIDO" }),
      makeLead({ id: "l3", assigned_to: "u1", lead_status: "NOVO" }),
    ];
    const [s] = calculateTeamPageData(leads, users, NOW);
    expect(s.total_leads).toBe(3);
  });

  it("inactive_duration_ms é null quando vendedor não tem leads", () => {
    const [s] = calculateTeamPageData([], [makeUser()], NOW);
    expect(s.inactive_duration_ms).toBeNull();
  });
});

// ─── calculateTeamKpis ───────────────────────────────────────────────────────

describe("calculateTeamKpis", () => {
  it("zeros para array vazio", () => {
    expect(calculateTeamKpis([])).toEqual({
      sellers_with_hot_lead: 0,
      sellers_inactive_2h: 0,
      total_closed_leads: 0,
    });
  });

  it("sellers_with_hot_lead conta apenas vendedores com hot_leads > 0", () => {
    const data = calculateTeamPageData(
      [
        makeLead({ id: "l1", assigned_to: "u1", score: 90 }),
        makeLead({ id: "l2", assigned_to: "u2", score: 30 }),
      ],
      [makeUser({ id: "u1" }), makeUser({ id: "u2", nome: "Bob" })],
      NOW
    );
    expect(calculateTeamKpis(data).sellers_with_hot_lead).toBe(1);
  });

  it("sellers_inactive_2h conta apenas vendedores com status = inactive", () => {
    const data = calculateTeamPageData(
      [
        makeLead({ id: "l1", assigned_to: "u1", updated_at: ts(3) }), // inactive
        makeLead({ id: "l2", assigned_to: "u2", updated_at: ts(1) }), // active
      ],
      [makeUser({ id: "u1" }), makeUser({ id: "u2", nome: "Bob" })],
      NOW
    );
    expect(calculateTeamKpis(data).sellers_inactive_2h).toBe(1);
  });

  it("total_closed_leads soma fechados de todos os vendedores", () => {
    const data = calculateTeamPageData(
      [
        makeLead({ id: "l1", assigned_to: "u1", lead_status: "FECHADO" }),
        makeLead({ id: "l2", assigned_to: "u1", lead_status: "FECHADO" }),
        makeLead({ id: "l3", assigned_to: "u2", lead_status: "FECHADO" }),
      ],
      [makeUser({ id: "u1" }), makeUser({ id: "u2", nome: "Bob" })],
      NOW
    );
    expect(calculateTeamKpis(data).total_closed_leads).toBe(3);
  });

  it("sem NaN ou Infinity nos valores retornados", () => {
    const kpis = calculateTeamKpis([]);
    for (const val of Object.values(kpis)) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});

// ─── buildTeamAlerts ─────────────────────────────────────────────────────────

describe("buildTeamAlerts", () => {
  it("retorna array vazio quando não há alertas relevantes", () => {
    const data = calculateTeamPageData(
      [makeLead({ assigned_to: "u1", score: 50, updated_at: ts(1) })],
      [makeUser()],
      NOW
    );
    expect(buildTeamAlerts(data)).toEqual([]);
  });

  it("alerta gerado para lead quente sem atividade >4h", () => {
    const data = calculateTeamPageData(
      [makeLead({ assigned_to: "u1", score: 90, updated_at: ts(5) })],
      [makeUser()],
      NOW
    );
    const alerts = buildTeamAlerts(data);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].seller_nome).toBe("João Silva");
    expect(alerts[0].hot_leads_stale).toBe(1);
  });

  it("alerta gerado para lead AGUARDANDO_HUMANO", () => {
    const data = calculateTeamPageData(
      [
        makeLead({
          assigned_to: "u1",
          conversation_status: "AGUARDANDO_HUMANO",
          updated_at: ts(5),
        }),
      ],
      [makeUser()],
      NOW
    );
    const alerts = buildTeamAlerts(data);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].awaiting_human).toBe(1);
  });

  it("sem alerta quando lead quente foi atualizado há <4h", () => {
    const data = calculateTeamPageData(
      [makeLead({ assigned_to: "u1", score: 90, updated_at: ts(2) })],
      [makeUser()],
      NOW
    );
    expect(buildTeamAlerts(data)).toHaveLength(0);
  });

  it("sem alerta para vendedor sem leads", () => {
    const data = calculateTeamPageData([], [makeUser()], NOW);
    expect(buildTeamAlerts(data)).toHaveLength(0);
  });
});

// ─── formatInactiveDuration ──────────────────────────────────────────────────

describe("formatInactiveDuration", () => {
  it("retorna horas para duração < 24h", () => {
    expect(formatInactiveDuration(2 * 60 * 60 * 1000)).toBe("2h");
    expect(formatInactiveDuration(5 * 60 * 60 * 1000)).toBe("5h");
    expect(formatInactiveDuration(23 * 60 * 60 * 1000)).toBe("23h");
  });

  it("retorna dias para duração >= 24h", () => {
    expect(formatInactiveDuration(24 * 60 * 60 * 1000)).toBe("1d");
    expect(formatInactiveDuration(48 * 60 * 60 * 1000)).toBe("2d");
  });

  it("trunca para inteiro (floor, não round)", () => {
    expect(formatInactiveDuration(2.9 * 60 * 60 * 1000)).toBe("2h");
    expect(formatInactiveDuration(25 * 60 * 60 * 1000)).toBe("1d");
  });
});
