import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — factories dos vi.mock()
// ---------------------------------------------------------------------------

const {
  mockFrom,
  mockRevalidate,
  mockGetServerStoreId,
  mockGetServerUserId,
  mockGetServerUserRole,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
  mockGetServerUserId: vi.fn(),
  mockGetServerUserRole: vi.fn(),
  mockLogAudit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
  getServerUserId: mockGetServerUserId,
  getServerUserRole: mockGetServerUserRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { advanceRenaveStage } from "@/lib/renave-actions";

// ---------------------------------------------------------------------------
// Helpers de mock
// ---------------------------------------------------------------------------

type MockVehicle = {
  id: string;
  renave_stage: string;
  renave_nfe_key: string | null;
} | null;

/** Chain: from("vehicles").select().eq().eq().maybeSingle() | .update({}).eq().eq() */
function makeVehicleChain(vehicle: MockVehicle, updateResult: { error: unknown } = { error: null }) {
  const updateEq2 = vi.fn().mockResolvedValue(updateResult);
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
  const updateSpy = vi.fn().mockReturnValue({ eq: updateEq1 });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: vehicle, error: null }),
    update: updateSpy,
  };
  return { chain, updateSpy, updateEq1, updateEq2 };
}

function formData(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  mockGetServerUserId.mockResolvedValue("actor-1");
  mockGetServerUserRole.mockResolvedValue("dono_loja");
  mockLogAudit.mockResolvedValue(undefined);
  mockRevalidate.mockReset();
  mockFrom.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

describe("advanceRenaveStage — RBAC", () => {
  it("dono_loja pode avançar", async () => {
    mockGetServerUserRole.mockResolvedValue("dono_loja");
    const { chain } = makeVehicleChain({
      id: "v1",
      renave_stage: "entrada_registrada",
      renave_nfe_key: null,
    });
    mockFrom.mockReturnValue(chain);

    await expect(
      advanceRenaveStage("v1", formData({ nfe_key: "35260600000000000000550010000000011000000010" }))
    ).resolves.toBeUndefined();
  });

  it("vendedor pode avançar", async () => {
    mockGetServerUserRole.mockResolvedValue("vendedor");
    const { chain } = makeVehicleChain({
      id: "v1",
      renave_stage: "chave_nfe_vinculada",
      renave_nfe_key: "35260600000000000000550010000000011000000010",
    });
    mockFrom.mockReturnValue(chain);

    await expect(advanceRenaveStage("v1", formData())).resolves.toBeUndefined();
  });

  it("bloqueia role fora de dono_loja/vendedor (ex: super_admin)", async () => {
    mockGetServerUserRole.mockResolvedValue("super_admin");
    await expect(advanceRenaveStage("v1", formData())).rejects.toThrow(
      /dono da loja ou vendedor/i
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sequência / skip / nfe_key
// ---------------------------------------------------------------------------

describe("advanceRenaveStage — regras de negócio", () => {
  it("veículo não encontrado (ou de outra loja) lança erro", async () => {
    const { chain } = makeVehicleChain(null);
    mockFrom.mockReturnValue(chain);

    await expect(advanceRenaveStage("v-inexistente", formData())).rejects.toThrow(
      /não encontrado/i
    );
  });

  it("avança de entrada_registrada -> chave_nfe_vinculada com nfe_key informada", async () => {
    const { chain, updateSpy } = makeVehicleChain({
      id: "v1",
      renave_stage: "entrada_registrada",
      renave_nfe_key: null,
    });
    mockFrom.mockReturnValue(chain);

    await advanceRenaveStage(
      "v1",
      formData({ nfe_key: "35260600000000000000550010000000011000000010" })
    );

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        renave_stage: "chave_nfe_vinculada",
        renave_nfe_key: "35260600000000000000550010000000011000000010",
        renave_stage_updated_by: "actor-1",
      })
    );
  });

  it("bloqueia avanço de entrada_registrada sem nfe_key", async () => {
    const { chain, updateSpy } = makeVehicleChain({
      id: "v1",
      renave_stage: "entrada_registrada",
      renave_nfe_key: null,
    });
    mockFrom.mockReturnValue(chain);

    await expect(advanceRenaveStage("v1", formData())).rejects.toThrow(/nf-e/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("bloqueia avanço a partir de saida_registrada (última etapa)", async () => {
    const { chain, updateSpy } = makeVehicleChain({
      id: "v1",
      renave_stage: "saida_registrada",
      renave_nfe_key: "35260600000000000000550010000000011000000010",
    });
    mockFrom.mockReturnValue(chain);

    await expect(advanceRenaveStage("v1", formData())).rejects.toThrow(/última etapa/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("nunca pula etapa — mesmo se o form tentar mandar um target_stage arbitrário", async () => {
    const { chain, updateSpy } = makeVehicleChain({
      id: "v1",
      renave_stage: "entrada_registrada",
      renave_nfe_key: null,
    });
    mockFrom.mockReturnValue(chain);

    // formulário malicioso/bugado tentando pular direto pra saida_registrada
    await advanceRenaveStage(
      "v1",
      formData({
        nfe_key: "35260600000000000000550010000000011000000010",
        target_stage: "saida_registrada",
      })
    );

    // ação ignora target_stage — sempre avança um degrau só
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ renave_stage: "chave_nfe_vinculada" })
    );
  });

  it("2->3 não exige reenvio de nfe_key (já persistida)", async () => {
    const { chain, updateSpy } = makeVehicleChain({
      id: "v1",
      renave_stage: "chave_nfe_vinculada",
      renave_nfe_key: "35260600000000000000550010000000011000000010",
    });
    mockFrom.mockReturnValue(chain);

    await advanceRenaveStage("v1", formData());

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ renave_stage: "documentos_protocolados" })
    );
  });

  it("registra audit log com from_stage/to_stage", async () => {
    const { chain } = makeVehicleChain({
      id: "v1",
      renave_stage: "documentos_protocolados",
      renave_nfe_key: "35260600000000000000550010000000011000000010",
    });
    mockFrom.mockReturnValue(chain);

    await advanceRenaveStage("v1", formData());

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        userId: "actor-1",
        action: "vehicle.renave_stage_advanced",
        resourceType: "vehicle",
        resourceId: "v1",
        metadata: { from_stage: "documentos_protocolados", to_stage: "saida_registrada" },
      })
    );
  });

  it("propaga erro do update sem registrar audit log", async () => {
    const { chain } = makeVehicleChain(
      { id: "v1", renave_stage: "documentos_protocolados", renave_nfe_key: "chave" },
      { error: new Error("db down") }
    );
    mockFrom.mockReturnValue(chain);

    await expect(advanceRenaveStage("v1", formData())).rejects.toThrow();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("revalida /renave e /estoque após sucesso", async () => {
    const { chain } = makeVehicleChain({
      id: "v1",
      renave_stage: "documentos_protocolados",
      renave_nfe_key: "chave",
    });
    mockFrom.mockReturnValue(chain);

    await advanceRenaveStage("v1", formData());

    expect(mockRevalidate).toHaveBeenCalledWith("/renave");
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });
});
