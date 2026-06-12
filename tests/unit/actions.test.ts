import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — variáveis para factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockTransitionConv, mockTransitionLead, mockRevalidate, mockGetServerStoreId, mockMarkReactivationConverted } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockTransitionConv: vi.fn(),
    mockTransitionLead: vi.fn(),
    mockRevalidate: vi.fn(),
    mockGetServerStoreId: vi.fn(),
    mockMarkReactivationConverted: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
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

vi.mock("@/lib/reactivation", () => ({
  markReactivationConverted: mockMarkReactivationConverted,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import {
  assignConversationToHuman,
  returnConversationToAI,
  updateLeadStatus,
  moveLeadStatus,
} from "@/lib/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chainInsert(result: unknown = { error: null }) {
  const c = {
    insert: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "x", lead_id: "lead-x" }, error: null }),
  };
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
  mockGetServerStoreId.mockResolvedValue("store-test");
  mockMarkReactivationConverted.mockResolvedValue(undefined);

  // Default: ownership checks pass. Tests that need specific insert chains call chainInsert().
  const defaultChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "x", lead_id: "lead-x" }, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  mockFrom.mockReturnValue(defaultChain);
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
    const chain = chainInsert();

    await expect(assignConversationToHuman("conv-encerrada")).rejects.toMatchObject(
      { name: "InvalidTransitionError" }
    );
    // Ownership check runs (mockFrom called), but insert never happens (error thrown by transition)
    expect(chain.insert).not.toHaveBeenCalled();
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
// Guardrail de Margem — Helpers
// ---------------------------------------------------------------------------

function makeCloseFormData(opts: {
  vehicleId?: string;
  valorFinal?: string | number;
} = {}): FormData {
  const fd = new FormData();
  fd.append("lead_status", "FECHADO");
  if (opts.vehicleId !== undefined) fd.append("vehicle_id", opts.vehicleId);
  if (opts.valorFinal !== undefined) fd.append("valor_final", String(opts.valorFinal));
  return fd;
}

function setupMultiTableMock(vehicleData: { id: string; custo: number; margem_minima: number } | null) {
  const leadsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "lead-1" }, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  const vehiclesChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: vehicleData, error: null }),
  };
  mockFrom.mockImplementation((table: string) => {
    if (table === "vehicles") return vehiclesChain;
    return leadsChain;
  });
}

// ---------------------------------------------------------------------------
// MARGIN — Guardrail de Margem no Fechamento
// ---------------------------------------------------------------------------

describe("updateLeadStatus — guardrail de margem no fechamento", () => {
  it("MARGIN-1: bloqueia fechamento sem vehicle_id", async () => {
    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ valorFinal: 80000 }))
    ).rejects.toThrow("Selecione o veículo vendido");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("MARGIN-2: bloqueia fechamento sem valor_final", async () => {
    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ vehicleId: "v-1" }))
    ).rejects.toThrow("Informe o valor de venda");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("MARGIN-2b: bloqueia fechamento com valor_final igual a zero", async () => {
    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ vehicleId: "v-1", valorFinal: 0 }))
    ).rejects.toThrow("Informe o valor de venda");
  });

  it("MARGIN-3: bloqueia fechamento abaixo do piso (custo + margem_minima)", async () => {
    setupMultiTableMock({ id: "v-1", custo: 70000, margem_minima: 8000 });
    // piso = 70000 + 8000 = 78000; valor = 77999 → bloqueado

    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ vehicleId: "v-1", valorFinal: 77999 }))
    ).rejects.toThrow("margem mínima");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });

  it("MARGIN-4: permite fechamento no exato piso (custo + margem_minima)", async () => {
    setupMultiTableMock({ id: "v-1", custo: 70000, margem_minima: 8000 });
    mockTransitionLead.mockResolvedValue({ from: "NEGOCIACAO", to: "FECHADO", changed: true });
    // piso = 78000; valor = 78000 → exato limite, deve passar

    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ vehicleId: "v-1", valorFinal: 78000 }))
    ).resolves.toBeUndefined();

    expect(mockTransitionLead).toHaveBeenCalledWith("lead-1", "FECHADO");
  });

  it("MARGIN-5: permite fechamento com valor acima do piso", async () => {
    setupMultiTableMock({ id: "v-1", custo: 70000, margem_minima: 8000 });
    mockTransitionLead.mockResolvedValue({ from: "NEGOCIACAO", to: "FECHADO", changed: true });

    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ vehicleId: "v-1", valorFinal: 90000 }))
    ).resolves.toBeUndefined();

    expect(mockTransitionLead).toHaveBeenCalledWith("lead-1", "FECHADO");
  });

  it("MARGIN-6: bloqueia vehicle_id de outra loja (cross-store guard)", async () => {
    setupMultiTableMock(null); // vehicle not found for this store
    // storeId guard: .eq("store_id", storeId) on vehicles query returns null

    await expect(
      updateLeadStatus("lead-1", "conv-1", makeCloseFormData({ vehicleId: "v-outra-loja", valorFinal: 90000 }))
    ).rejects.toThrow("Veículo não encontrado");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });
});

describe("moveLeadStatus — bloqueia FECHADO no Kanban", () => {
  it("MARGIN-7: rejeita tentativa de fechar via moveLeadStatus", async () => {
    const fd = new FormData();
    fd.append("lead_status", "FECHADO");

    await expect(moveLeadStatus("lead-1", fd)).rejects.toThrow("página da conversa");

    expect(mockTransitionLead).not.toHaveBeenCalled();
  });
});

