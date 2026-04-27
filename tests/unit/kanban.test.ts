import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockTransitionLead, mockRevalidate } = vi.hoisted(() => ({
  mockTransitionLead: vi.fn(),
  mockRevalidate: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/status", () => ({
  transitionLeadStatus: mockTransitionLead,
  LEAD_TRANSITIONS: {
    NOVO:        ["ENGAJADO", "PERDIDO"],
    ENGAJADO:    ["INTERESSADO", "QUENTE", "PERDIDO"],
    INTERESSADO: ["QUENTE", "ENGAJADO", "PERDIDO"],
    QUENTE:      ["NEGOCIACAO", "INTERESSADO", "PERDIDO"],
    NEGOCIACAO:  ["FECHADO", "PERDIDO", "QUENTE"],
    FECHADO:     [],
    PERDIDO:     ["ENGAJADO"],
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { moveLeadStatus } from "@/lib/actions";
import { LEAD_TRANSITIONS } from "@/lib/status";
import { sortLeads } from "@/lib/lead-priority";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(status: string): FormData {
  const fd = new FormData();
  fd.append("lead_status", status);
  return fd;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// T1 — moveLeadStatus delega transição válida para transitionLeadStatus
// ---------------------------------------------------------------------------

describe("moveLeadStatus", () => {
  it("T1: transição válida → transitionLeadStatus chamado com leadId e status corretos", async () => {
    mockTransitionLead.mockResolvedValue({ from: "NOVO", to: "ENGAJADO", changed: true });

    await moveLeadStatus("lead-1", makeFormData("ENGAJADO"));

    expect(mockTransitionLead).toHaveBeenCalledWith("lead-1", "ENGAJADO");
  });

  it("T2: status fora do enum → lança Error antes de chamar transitionLeadStatus", async () => {
    await expect(
      moveLeadStatus("lead-1", makeFormData("STATUS_INVENTADO"))
    ).rejects.toThrow("Status inválido: STATUS_INVENTADO");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("T3: transição inválida (mocked rejection de transitionLeadStatus) → erro propagado", async () => {
    const err = new Error("Transicao invalida em lead_status: FECHADO -> ENGAJADO");
    err.name = "InvalidTransitionError";
    mockTransitionLead.mockRejectedValue(err);

    await expect(
      moveLeadStatus("lead-1", makeFormData("ENGAJADO"))
    ).rejects.toMatchObject({ name: "InvalidTransitionError" });
  });

  it("T4: ConcurrentTransitionError propagado sem quebrar", async () => {
    const err = new Error("Transicao concorrente detectada em lead_status lead-1");
    err.name = "ConcurrentTransitionError";
    mockTransitionLead.mockRejectedValue(err);

    await expect(
      moveLeadStatus("lead-1", makeFormData("ENGAJADO"))
    ).rejects.toMatchObject({ name: "ConcurrentTransitionError" });
  });

  it("T5: revalidatePath('/leads') chamado após transição bem-sucedida", async () => {
    mockTransitionLead.mockResolvedValue({ from: "NOVO", to: "ENGAJADO", changed: true });

    await moveLeadStatus("lead-abc", makeFormData("ENGAJADO"));

    expect(mockRevalidate).toHaveBeenCalledWith("/leads");
  });
});

// ---------------------------------------------------------------------------
// T6–T8 — LEAD_TRANSITIONS: regras do domínio para o dropdown do Kanban
// ---------------------------------------------------------------------------

describe("LEAD_TRANSITIONS (dados do domínio para o dropdown)", () => {
  it("T6: FECHADO é terminal — dropdown não exibe opções de mover", () => {
    expect(LEAD_TRANSITIONS.FECHADO).toHaveLength(0);
  });

  it("T7: NOVO permite ir para ENGAJADO e PERDIDO (funil inicial)", () => {
    expect(LEAD_TRANSITIONS.NOVO).toEqual(expect.arrayContaining(["ENGAJADO", "PERDIDO"]));
    expect(LEAD_TRANSITIONS.NOVO).toHaveLength(2);
  });

  it("T8: PERDIDO permite apenas reativação para ENGAJADO", () => {
    expect(LEAD_TRANSITIONS.PERDIDO).toEqual(["ENGAJADO"]);
    expect(LEAD_TRANSITIONS.PERDIDO).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T9 — sortLeads ordena leads quentes primeiro dentro de cada coluna
// ---------------------------------------------------------------------------

describe("sortLeads (ordenação dentro das colunas do Kanban)", () => {
  it("T9: leads hot aparecem antes de warm e cold; dentro de hot, maior score primeiro", () => {
    const now = new Date().toISOString();

    const leads = [
      { id: "c", nome: "Cold", phone_normalized: "+55", score: 10, lead_status: "NOVO" as const, ultima_atividade: now, priority: "cold" as const, priority_label: "Frio", recommended_action: "" },
      { id: "a", nome: "Hot High", phone_normalized: "+55", score: 90, lead_status: "NOVO" as const, ultima_atividade: now, priority: "hot"  as const, priority_label: "Quente", recommended_action: "" },
      { id: "b", nome: "Hot Low",  phone_normalized: "+55", score: 82, lead_status: "NOVO" as const, ultima_atividade: now, priority: "hot"  as const, priority_label: "Quente", recommended_action: "" },
      { id: "d", nome: "Warm",     phone_normalized: "+55", score: 55, lead_status: "NOVO" as const, ultima_atividade: now, priority: "warm" as const, priority_label: "Morno", recommended_action: "" },
    ];

    const sorted = sortLeads(leads);

    expect(sorted[0].id).toBe("a"); // hot, score 90
    expect(sorted[1].id).toBe("b"); // hot, score 82
    expect(sorted[2].id).toBe("d"); // warm
    expect(sorted[3].id).toBe("c"); // cold
  });
});
