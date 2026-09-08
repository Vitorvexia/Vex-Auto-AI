import { describe, it, expect } from "vitest";
import { canTransitionLead, validLeadTargets, LEAD_TRANSITIONS } from "@/lib/lead-transitions";
import type { LeadStatus } from "@/types/domain";

// ---------------------------------------------------------------------------
// canTransitionLead
// ---------------------------------------------------------------------------

describe("canTransitionLead", () => {
  it("T1: mesmo status (from === to) é sempre permitido", () => {
    expect(canTransitionLead("NOVO", "NOVO")).toBe(true);
    expect(canTransitionLead("FECHADO", "FECHADO")).toBe(true);
  });

  it("T2: transição listada em LEAD_TRANSITIONS é permitida", () => {
    expect(canTransitionLead("NOVO", "ENGAJADO")).toBe(true);
  });

  it("T3: transição não listada é rejeitada", () => {
    expect(canTransitionLead("NOVO", "FECHADO")).toBe(false);
  });

  it("T4: FECHADO é terminal — nenhuma transição de saída", () => {
    expect(canTransitionLead("FECHADO", "ENGAJADO")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validLeadTargets — usado pro menu de troca de status no LeadCard
// (fallback acessível ao drag-and-drop do Kanban)
// ---------------------------------------------------------------------------

describe("validLeadTargets", () => {
  it("T1: nunca inclui FECHADO, mesmo quando LEAD_TRANSITIONS lista (NEGOCIACAO → FECHADO)", () => {
    expect(LEAD_TRANSITIONS.NEGOCIACAO).toContain("FECHADO"); // pré-condição do teste
    expect(validLeadTargets("NEGOCIACAO")).not.toContain("FECHADO");
  });

  it("T2: NOVO → ENGAJADO e PERDIDO", () => {
    expect(validLeadTargets("NOVO")).toEqual(expect.arrayContaining(["ENGAJADO", "PERDIDO"]));
    expect(validLeadTargets("NOVO")).toHaveLength(2);
  });

  it("T3: FECHADO (terminal) → array vazio", () => {
    expect(validLeadTargets("FECHADO")).toEqual([]);
  });

  it("T4: PERDIDO → só ENGAJADO (reativação)", () => {
    expect(validLeadTargets("PERDIDO")).toEqual(["ENGAJADO"]);
  });

  it("T5: nunca retorna o próprio status atual (from não aparece na própria lista)", () => {
    const allStatuses: LeadStatus[] = ["NOVO", "ENGAJADO", "INTERESSADO", "QUENTE", "NEGOCIACAO", "FECHADO", "PERDIDO"];
    for (const status of allStatuses) {
      expect(validLeadTargets(status)).not.toContain(status);
    }
  });
});
