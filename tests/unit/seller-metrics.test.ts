import { describe, it, expect } from "vitest";
import {
  calculateSellerMetrics,
  getStoreAssignmentSummary,
  getLeadsWithoutOwner,
} from "@/lib/seller-metrics";
import type { Lead } from "@/types/domain";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    nome: "Lead Test",
    phone_normalized: "+5511999990001",
    score: 50,
    lead_status: "NOVO",
    assigned_to: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

type SellerUser = { id: string; nome: string };

function makeUser(overrides: Partial<SellerUser> = {}): SellerUser {
  return { id: "user-1", nome: "Vendedor 1", ...overrides };
}

// ---------------------------------------------------------------------------
// calculateSellerMetrics
// ---------------------------------------------------------------------------

describe("calculateSellerMetrics", () => {
  it("retorna array vazio quando não há leads atribuídos a nenhum vendedor", () => {
    const result = calculateSellerMetrics([], [makeUser()]);
    expect(result).toEqual([]);
  });

  it("retorna array vazio quando não há vendedores", () => {
    const leads = [makeLead({ assigned_to: "user-1" })];
    const result = calculateSellerMetrics(leads, []);
    expect(result).toEqual([]);
  });

  it("conta total_leads por vendedor corretamente", () => {
    const users = [makeUser({ id: "u1", nome: "Alice" })];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1" }),
      makeLead({ id: "l2", assigned_to: "u1" }),
    ];
    const result = calculateSellerMetrics(leads, users);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ userId: "u1", nome: "Alice", total_leads: 2 });
  });

  it("conta hot_leads para leads com score >= 80", () => {
    const users = [makeUser({ id: "u1" })];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", score: 80 }),
      makeLead({ id: "l2", assigned_to: "u1", score: 79 }),
      makeLead({ id: "l3", assigned_to: "u1", score: 100 }),
    ];
    const result = calculateSellerMetrics(leads, users);
    expect(result[0].hot_leads).toBe(2);
  });

  it("hot_leads = 0 para leads com score < 80 sem handoff", () => {
    const users = [makeUser({ id: "u1" })];
    const leads = [makeLead({ id: "l1", assigned_to: "u1", score: 79 })];
    const result = calculateSellerMetrics(leads, users);
    expect(result[0].hot_leads).toBe(0);
  });

  it("conta hot_leads para lead com score < 80 mas conversation_status = AGUARDANDO_HUMANO (handoff)", () => {
    const users = [makeUser({ id: "u1" })];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", score: 50, conversation_status: "AGUARDANDO_HUMANO" }),
      makeLead({ id: "l2", assigned_to: "u1", score: 30, conversation_status: "ATIVA" }),
    ];
    const result = calculateSellerMetrics(leads, users);
    expect(result[0].hot_leads).toBe(1); // only l1 qualifies via handoff
  });

  it("conta closed_leads para leads com lead_status = FECHADO", () => {
    const users = [makeUser({ id: "u1" })];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", lead_status: "FECHADO" }),
      makeLead({ id: "l2", assigned_to: "u1", lead_status: "NOVO" }),
      makeLead({ id: "l3", assigned_to: "u1", lead_status: "FECHADO" }),
    ];
    const result = calculateSellerMetrics(leads, users);
    expect(result[0].closed_leads).toBe(2);
  });

  it("segrega métricas entre vendedores sem contaminação cruzada", () => {
    const users = [
      makeUser({ id: "u1", nome: "Alice" }),
      makeUser({ id: "u2", nome: "Bob" }),
    ];
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1", score: 90, lead_status: "NOVO" }),
      makeLead({ id: "l2", assigned_to: "u2", score: 40, lead_status: "FECHADO" }),
      makeLead({ id: "l3", assigned_to: "u1", lead_status: "FECHADO" }),
    ];
    const result = calculateSellerMetrics(leads, users);
    const alice = result.find((r) => r.userId === "u1")!;
    const bob = result.find((r) => r.userId === "u2")!;

    expect(alice.total_leads).toBe(2);
    expect(alice.hot_leads).toBe(1);
    expect(alice.closed_leads).toBe(1);

    expect(bob.total_leads).toBe(1);
    expect(bob.hot_leads).toBe(0);
    expect(bob.closed_leads).toBe(1);
  });

  it("não inclui leads com assigned_to = null nas métricas de vendedor", () => {
    const users = [makeUser({ id: "u1" })];
    const leads = [
      makeLead({ id: "l1", assigned_to: null }),
      makeLead({ id: "l2", assigned_to: "u1" }),
    ];
    const result = calculateSellerMetrics(leads, users);
    expect(result[0].total_leads).toBe(1);
  });

  it("não inclui vendedor no resultado se não há leads atribuídos a ele", () => {
    const users = [
      makeUser({ id: "u1" }),
      makeUser({ id: "u2" }),
    ];
    const leads = [makeLead({ id: "l1", assigned_to: "u1" })];
    const result = calculateSellerMetrics(leads, users);
    // Only u1 appears — u2 has no leads
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u1");
  });
});

// ---------------------------------------------------------------------------
// getStoreAssignmentSummary
// ---------------------------------------------------------------------------

describe("getStoreAssignmentSummary", () => {
  it("retorna zeros para array vazio", () => {
    const result = getStoreAssignmentSummary([]);
    expect(result).toEqual({ leads_with_owner: 0, leads_without_owner: 0 });
  });

  it("conta leads_with_owner e leads_without_owner corretamente em mix", () => {
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1" }),
      makeLead({ id: "l2", assigned_to: null }),
      makeLead({ id: "l3", assigned_to: "u2" }),
    ];
    const result = getStoreAssignmentSummary(leads);
    expect(result.leads_with_owner).toBe(2);
    expect(result.leads_without_owner).toBe(1);
  });

  it("todos com owner → leads_without_owner = 0", () => {
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1" }),
      makeLead({ id: "l2", assigned_to: "u2" }),
    ];
    const result = getStoreAssignmentSummary(leads);
    expect(result.leads_without_owner).toBe(0);
    expect(result.leads_with_owner).toBe(2);
  });

  it("nenhum com owner → leads_with_owner = 0", () => {
    const leads = [
      makeLead({ id: "l1", assigned_to: null }),
      makeLead({ id: "l2", assigned_to: null }),
    ];
    const result = getStoreAssignmentSummary(leads);
    expect(result.leads_with_owner).toBe(0);
    expect(result.leads_without_owner).toBe(2);
  });

  it("não retorna NaN ou Infinity", () => {
    const result = getStoreAssignmentSummary([makeLead()]);
    for (const val of Object.values(result)) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getLeadsWithoutOwner
// ---------------------------------------------------------------------------

describe("getLeadsWithoutOwner", () => {
  it("retorna array vazio para input vazio", () => {
    expect(getLeadsWithoutOwner([])).toHaveLength(0);
  });

  it("retorna array vazio quando todos têm owner", () => {
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1" }),
      makeLead({ id: "l2", assigned_to: "u2" }),
    ];
    expect(getLeadsWithoutOwner(leads)).toHaveLength(0);
  });

  it("retorna apenas leads com assigned_to = null", () => {
    const leads = [
      makeLead({ id: "l1", assigned_to: null }),
      makeLead({ id: "l2", assigned_to: "u1" }),
      makeLead({ id: "l3", assigned_to: null }),
    ];
    const result = getLeadsWithoutOwner(leads);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toContain("l1");
    expect(result.map((l) => l.id)).toContain("l3");
  });

  it("não inclui leads com owner válido no resultado", () => {
    const leads = [
      makeLead({ id: "l1", assigned_to: "u1" }),
      makeLead({ id: "l2", assigned_to: null }),
    ];
    const result = getLeadsWithoutOwner(leads);
    expect(result.map((l) => l.id)).not.toContain("l1");
  });
});
