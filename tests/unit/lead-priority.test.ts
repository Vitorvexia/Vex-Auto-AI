import { describe, it, expect } from "vitest";
import {
  calculateLeadPriority,
  sortLeads,
  type PriorityInput,
  type PriorityTier,
} from "@/lib/lead-priority";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function input(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    score: 0,
    leadStatus: "NOVO",
    conversationStatus: null,
    ultimaAtividade: null,
    ...overrides,
  };
}

type SortLead = {
  priority: PriorityTier;
  score: number;
  ultima_atividade: string | null | undefined;
};

// ---------------------------------------------------------------------------
// calculateLeadPriority
// ---------------------------------------------------------------------------

describe("calculateLeadPriority — HOT via score", () => {
  it("T1: score >= 80 → hot, reasons = ['score >= 80']", () => {
    const r = calculateLeadPriority(input({ score: 85 }));
    expect(r.priority).toBe("hot");
    expect(r.reasons).toContain("score >= 80");
  });

  it("T1b: score = 80 → hot (limiar exato do threshold)", () => {
    const r = calculateLeadPriority(input({ score: 80 }));
    expect(r.priority).toBe("hot");
    expect(r.reasons).toContain("score >= 80");
  });
});

describe("calculateLeadPriority — WARM", () => {
  it("T2: score 40–79 (mid) → warm", () => {
    const r = calculateLeadPriority(input({ score: 60 }));
    expect(r.priority).toBe("warm");
  });

  it("T8: score = 40 → warm (extremo inferior inclusivo)", () => {
    const r = calculateLeadPriority(input({ score: 40 }));
    expect(r.priority).toBe("warm");
  });

  it("T9: score = 79 → warm (extremo superior inclusivo, sem handoff)", () => {
    const r = calculateLeadPriority(input({ score: 79 }));
    expect(r.priority).toBe("warm");
  });
});

describe("calculateLeadPriority — COLD", () => {
  it("T3: score < 40 → cold", () => {
    const r = calculateLeadPriority(input({ score: 20 }));
    expect(r.priority).toBe("cold");
  });

  it("T3b: score = 0 → cold (extremo inferior não-null)", () => {
    const r = calculateLeadPriority(input({ score: 0 }));
    expect(r.priority).toBe("cold");
  });
});

describe("calculateLeadPriority — HOT via handoff", () => {
  it("T4: AGUARDANDO_HUMANO com score < 80 → hot, reasons = ['handoff_ativo']", () => {
    const r = calculateLeadPriority(
      input({ score: 30, conversationStatus: "AGUARDANDO_HUMANO" })
    );
    expect(r.priority).toBe("hot");
    expect(r.reasons).toContain("handoff_ativo");
  });

  it("T5: score 79 + AGUARDANDO_HUMANO → hot via handoff, reasons = ['handoff_ativo']", () => {
    const r = calculateLeadPriority(
      input({ score: 79, conversationStatus: "AGUARDANDO_HUMANO" })
    );
    expect(r.priority).toBe("hot");
    expect(r.reasons).toContain("handoff_ativo");
  });
});

describe("calculateLeadPriority — short-circuit", () => {
  it("T6: score 80 + ATIVA → hot via score, reasons = ['score >= 80']", () => {
    const r = calculateLeadPriority(
      input({ score: 80, conversationStatus: "ATIVA" })
    );
    expect(r.priority).toBe("hot");
    expect(r.reasons).toContain("score >= 80");
    expect(r.reasons).not.toContain("handoff_ativo");
  });

  it("T7: score 80 + AGUARDANDO_HUMANO → hot via score (short-circuit), reasons = ['score >= 80']", () => {
    const r = calculateLeadPriority(
      input({ score: 80, conversationStatus: "AGUARDANDO_HUMANO" })
    );
    expect(r.priority).toBe("hot");
    expect(r.reasons).toContain("score >= 80");
    expect(r.reasons).not.toContain("handoff_ativo");
  });
});

describe("calculateLeadPriority — fallback seguro", () => {
  it("T10: score = undefined → cold, sem exceção", () => {
    expect(() =>
      calculateLeadPriority(input({ score: undefined, conversationStatus: null }))
    ).not.toThrow();
    const r = calculateLeadPriority(input({ score: undefined, conversationStatus: null }));
    expect(r.priority).toBe("cold");
  });

  it("T10b: score = null → cold, sem exceção", () => {
    expect(() =>
      calculateLeadPriority(input({ score: null, conversationStatus: null }))
    ).not.toThrow();
    const r = calculateLeadPriority(input({ score: null, conversationStatus: null }));
    expect(r.priority).toBe("cold");
  });
});

// ---------------------------------------------------------------------------
// sortLeads
// ---------------------------------------------------------------------------

describe("sortLeads", () => {
  it("T11: ordena hot antes de warm antes de cold", () => {
    const leads: SortLead[] = [
      { priority: "warm", score: 60, ultima_atividade: null },
      { priority: "cold", score: 10, ultima_atividade: null },
      { priority: "hot",  score: 90, ultima_atividade: null },
    ];
    const sorted = sortLeads(leads);
    expect(sorted[0].priority).toBe("hot");
    expect(sorted[1].priority).toBe("warm");
    expect(sorted[2].priority).toBe("cold");
  });

  it("T11b: não muta o array original", () => {
    const leads: SortLead[] = [
      { priority: "warm", score: 60, ultima_atividade: null },
      { priority: "hot",  score: 90, ultima_atividade: null },
    ];
    const original = [...leads];
    sortLeads(leads);
    expect(leads[0].priority).toBe(original[0].priority);
    expect(leads[1].priority).toBe(original[1].priority);
  });

  it("T12: dentro do mesmo tier, ordena por score desc", () => {
    const leads: SortLead[] = [
      { priority: "warm", score: 50, ultima_atividade: null },
      { priority: "warm", score: 75, ultima_atividade: null },
      { priority: "warm", score: 40, ultima_atividade: null },
    ];
    const sorted = sortLeads(leads);
    expect(sorted[0].score).toBe(75);
    expect(sorted[1].score).toBe(50);
    expect(sorted[2].score).toBe(40);
  });

  it("T14: array vazio → retorna array vazio sem exceção", () => {
    expect(sortLeads([])).toEqual([]);
  });

  it("T13: mesmo score → ultima_atividade mais recente primeiro; undefined → fim (sem NaN)", () => {
    const leads: SortLead[] = [
      { priority: "warm", score: 60, ultima_atividade: undefined },
      { priority: "warm", score: 60, ultima_atividade: "2024-01-01T10:00:00Z" },
      { priority: "warm", score: 60, ultima_atividade: "2024-01-03T10:00:00Z" },
    ];
    const sorted = sortLeads(leads);
    expect(sorted[0].ultima_atividade).toBe("2024-01-03T10:00:00Z");
    expect(sorted[1].ultima_atividade).toBe("2024-01-01T10:00:00Z");
    expect(sorted[2].ultima_atividade).toBeUndefined();
  });
});
