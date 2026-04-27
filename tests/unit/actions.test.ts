import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — variáveis para factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockTransitionConv, mockTransitionLead, mockRevalidate } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockTransitionConv: vi.fn(),
    mockTransitionLead: vi.fn(),
    mockRevalidate: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/status", () => ({
  transitionConversationStatus: mockTransitionConv,
  transitionLeadStatus: mockTransitionLead,
  LEAD_TRANSITIONS: {
    NOVO: ["ENGAJADO", "PERDIDO"],
    ENGAJADO: ["INTERESSADO", "QUENTE", "PERDIDO"],
    INTERESSADO: ["QUENTE", "ENGAJADO", "PERDIDO"],
    QUENTE: ["NEGOCIACAO", "INTERESSADO", "PERDIDO"],
    NEGOCIACAO: ["FECHADO", "PERDIDO", "QUENTE"],
    FECHADO: [],
    PERDIDO: ["ENGAJADO"],
  },
  canTransitionLead: vi.fn((from: string, to: string) => from !== to),
  InvalidTransitionError: class InvalidTransitionError extends Error {
    constructor(kind: string, from: string, to: string) {
      super(`Transicao invalida em ${kind}: ${from} -> ${to}`);
      this.name = "InvalidTransitionError";
    }
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import {
  assignConversationToHuman,
  returnConversationToAI,
  updateLeadStatus,
  saveFinancingSimulation,
} from "@/lib/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chainInsert(result: unknown = { error: null }) {
  const c = { insert: vi.fn().mockResolvedValue(result) };
  mockFrom.mockReturnValue(c);
  return c;
}

function makeFormData(leadStatus: string): FormData {
  const fd = new FormData();
  fd.append("lead_status", leadStatus);
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
// T1 — assignConversationToHuman muda handoff_to para HUMANO
// ---------------------------------------------------------------------------

describe("assignConversationToHuman", () => {
  it("T1: chama transitionConversationStatus com AGUARDANDO_HUMANO + handoff_to=HUMANO + assigned_to=null", async () => {
    mockTransitionConv.mockResolvedValue({ from: "ATIVA", to: "AGUARDANDO_HUMANO", changed: true });
    chainInsert();

    await assignConversationToHuman("conv-1");

    expect(mockTransitionConv).toHaveBeenCalledWith("conv-1", "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
      assigned_to: null,
    });
  });

  it("T4: insere message de sistema após assumir", async () => {
    mockTransitionConv.mockResolvedValue({ from: "ATIVA", to: "AGUARDANDO_HUMANO", changed: true });
    const insertChain = chainInsert();

    await assignConversationToHuman("conv-1");

    expect(mockFrom).toHaveBeenCalledWith("messages");
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        autor: "sistema",
        mensagem: "Conversa assumida por humano",
      })
    );
  });

  it("T7: conversa ENCERRADA → erro propagado (InvalidTransitionError)", async () => {
    const err = new Error("Transicao invalida em conversation_status: ENCERRADA -> AGUARDANDO_HUMANO");
    err.name = "InvalidTransitionError";
    mockTransitionConv.mockRejectedValue(err);

    await expect(assignConversationToHuman("conv-encerrada")).rejects.toMatchObject(
      { name: "InvalidTransitionError" }
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T2 — returnConversationToAI muda para IA
// ---------------------------------------------------------------------------

describe("returnConversationToAI", () => {
  it("T2: chama transitionConversationStatus com ATIVA + handoff_to=IA + assigned_to=null", async () => {
    mockTransitionConv.mockResolvedValue({ from: "AGUARDANDO_HUMANO", to: "ATIVA", changed: true });
    chainInsert();

    await returnConversationToAI("conv-1");

    expect(mockTransitionConv).toHaveBeenCalledWith("conv-1", "ATIVA", {
      handoff_to: "IA",
      assigned_to: null,
    });
  });

  it("T4b: insere message de sistema ao retornar para IA", async () => {
    mockTransitionConv.mockResolvedValue({ from: "AGUARDANDO_HUMANO", to: "ATIVA", changed: true });
    const insertChain = chainInsert();

    await returnConversationToAI("conv-1");

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        autor: "sistema",
        mensagem: "Conversa retornada para IA",
      })
    );
  });
});

// ---------------------------------------------------------------------------
// T3 — assigned_to é sempre null neste PR
// ---------------------------------------------------------------------------

describe("assigned_to = null", () => {
  it("T3: assignConversationToHuman sempre passa assigned_to=null", async () => {
    mockTransitionConv.mockResolvedValue({ from: "ATIVA", to: "AGUARDANDO_HUMANO", changed: true });
    chainInsert();

    await assignConversationToHuman("conv-1");

    const [, , opts] = mockTransitionConv.mock.calls[0] as [string, string, { assigned_to: unknown }];
    expect(opts.assigned_to).toBeNull();
  });

  it("T3b: returnConversationToAI sempre passa assigned_to=null", async () => {
    mockTransitionConv.mockResolvedValue({ from: "AGUARDANDO_HUMANO", to: "ATIVA", changed: true });
    chainInsert();

    await returnConversationToAI("conv-1");

    const [, , opts] = mockTransitionConv.mock.calls[0] as [string, string, { assigned_to: unknown }];
    expect(opts.assigned_to).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T5 / T6 — updateLeadStatus respeita transições válidas
// ---------------------------------------------------------------------------

describe("updateLeadStatus", () => {
  it("T5: delega a transitionLeadStatus com o status correto", async () => {
    mockTransitionLead.mockResolvedValue({ from: "QUENTE", to: "NEGOCIACAO", changed: true });

    await updateLeadStatus("lead-1", "conv-1", makeFormData("NEGOCIACAO"));

    expect(mockTransitionLead).toHaveBeenCalledWith("lead-1", "NEGOCIACAO");
  });

  it("T6: status inválido (não pertence ao enum) → lança Error antes de chamar transitionLeadStatus", async () => {
    await expect(
      updateLeadStatus("lead-1", "conv-1", makeFormData("STATUS_INVENTADO"))
    ).rejects.toThrow("Status inválido: STATUS_INVENTADO");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("T6b: transição inválida (FECHADO → qualquer) → erro propagado de transitionLeadStatus", async () => {
    const err = new Error("Transicao invalida em lead_status: FECHADO -> ENGAJADO");
    err.name = "InvalidTransitionError";
    mockTransitionLead.mockRejectedValue(err);

    await expect(
      updateLeadStatus("lead-1", "conv-1", makeFormData("ENGAJADO"))
    ).rejects.toMatchObject({ name: "InvalidTransitionError" });
  });

  it("revalidatePath chamado para conversation e /conversations após updateLeadStatus", async () => {
    mockTransitionLead.mockResolvedValue({ from: "QUENTE", to: "NEGOCIACAO", changed: true });

    await updateLeadStatus("lead-1", "conv-abc", makeFormData("NEGOCIACAO"));

    expect(mockRevalidate).toHaveBeenCalledWith("/conversations/conv-abc");
    expect(mockRevalidate).toHaveBeenCalledWith("/conversations");
  });
});

// ---------------------------------------------------------------------------
// S1–S5 — saveFinancingSimulation
// ---------------------------------------------------------------------------

describe("saveFinancingSimulation", () => {
  function makeSimFormData(overrides: Partial<Record<string, string>> = {}): FormData {
    const fd = new FormData();
    fd.append("vehicle_price", overrides.vehicle_price ?? "50000");
    fd.append("entry_value", overrides.entry_value ?? "5000");
    fd.append("term_months", overrides.term_months ?? "48");
    return fd;
  }

  function setupTwoTableMocks() {
    const insertSim = vi.fn().mockResolvedValue({ error: null });
    const insertMsg = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "financing_simulations") return { insert: insertSim };
      if (table === "messages") return { insert: insertMsg };
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
    return { insertSim, insertMsg };
  }

  it("S1: vehicle_price <= 0 → não insere nenhuma row", async () => {
    const { insertSim, insertMsg } = setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-1", "store-1", makeSimFormData({ vehicle_price: "0" }));

    expect(insertSim).not.toHaveBeenCalled();
    expect(insertMsg).not.toHaveBeenCalled();
  });

  it("S1b: term_months fora do range (< 12) → não insere", async () => {
    const { insertSim } = setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-1", "store-1", makeSimFormData({ term_months: "6" }));

    expect(insertSim).not.toHaveBeenCalled();
  });

  it("S1c: term_months fora do range (> 72) → não insere", async () => {
    const { insertSim } = setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-1", "store-1", makeSimFormData({ term_months: "84" }));

    expect(insertSim).not.toHaveBeenCalled();
  });

  it("S2: entrada válida → insere em financing_simulations com store_id e provider='internal'", async () => {
    const { insertSim } = setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-1", "store-99", makeSimFormData());

    expect(insertSim).toHaveBeenCalledOnce();
    expect(insertSim).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store-99",
        lead_id: "lead-1",
        conversation_id: "conv-1",
        provider: "internal",
        vehicle_price: 50000,
        entry_value: 5000,
        term_months: 48,
      })
    );
  });

  it("S3: mensagem de sistema inserida contendo 'estimada'", async () => {
    const { insertMsg } = setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-1", "store-1", makeSimFormData());

    expect(insertMsg).toHaveBeenCalledOnce();
    const call = insertMsg.mock.calls[0][0] as { mensagem: string };
    expect(call.mensagem).toContain("estimada");
  });

  it("S4: mensagem de sistema NÃO contém 'aprovado' nem 'aprovação'", async () => {
    const { insertMsg } = setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-1", "store-1", makeSimFormData());

    const call = insertMsg.mock.calls[0][0] as { mensagem: string };
    expect(call.mensagem.toLowerCase()).not.toContain("aprovado");
    expect(call.mensagem.toLowerCase()).not.toContain("aprovação");
  });

  it("S5: revalidatePath chamado para a conversa após insert", async () => {
    setupTwoTableMocks();

    await saveFinancingSimulation("lead-1", "conv-42", "store-1", makeSimFormData());

    expect(mockRevalidate).toHaveBeenCalledWith("/conversations/conv-42");
  });
});
