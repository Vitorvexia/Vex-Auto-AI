import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — mock factories
// ---------------------------------------------------------------------------

const { mockFrom, mockRevalidate, mockGetServerStoreId } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
  AuthError: class AuthError extends Error {},
  StoreNotFoundError: class StoreNotFoundError extends Error {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { createVehicle, updateVehicle, archiveVehicle, unarchiveVehicle } from "@/lib/vehicle-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "v-1" }, error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

const validFields = {
  marca: "Honda",
  modelo: "Civic",
  ano: "2022",
  preco: "89000",
  custo: "75000",
  margem_minima: "3000",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  makeChain();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createVehicle
// ---------------------------------------------------------------------------

describe("createVehicle", () => {
  it("V1: insere veículo em vehicles com store_id correto", async () => {
    const chain = makeChain();
    await createVehicle(fd(validFields));
    expect(mockFrom).toHaveBeenCalledWith("vehicles");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store-1",
        marca: "Honda",
        modelo: "Civic",
        ano: 2022,
        preco: 89000,
        custo: 75000,
        margem_minima: 3000,
      })
    );
  });

  it("V2: revalidatePath('/estoque') chamado após inserção", async () => {
    await createVehicle(fd(validFields));
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("V3: lança erro se insert falhar", async () => {
    const chain = makeChain();
    chain.insert.mockResolvedValue({ error: { message: "DB error", code: "23505" } });
    await expect(createVehicle(fd(validFields))).rejects.toBeDefined();
  });

  it("V4: lança erro se campo obrigatório (modelo) ausente", async () => {
    await expect(
      createVehicle(fd({ marca: "Honda", ano: "2022", preco: "89000", custo: "75000" }))
    ).rejects.toThrow("Campos obrigatórios ausentes");
  });

  it("V4b: margem_minima ausente usa 0 como padrão (não lança erro)", async () => {
    const chain = makeChain();
    const withoutMargem = { ...validFields };
    delete (withoutMargem as Partial<typeof validFields>).margem_minima;
    await createVehicle(fd(withoutMargem as Record<string, string>));
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ margem_minima: 0 })
    );
  });
});

// ---------------------------------------------------------------------------
// updateVehicle
// ---------------------------------------------------------------------------

describe("updateVehicle", () => {
  it("V5: verifica ownership e atualiza campos do veículo", async () => {
    const chain = makeChain();
    await updateVehicle("v-1", fd(validFields));
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        marca: "Honda",
        modelo: "Civic",
        ano: 2022,
        preco: 89000,
        custo: 75000,
        margem_minima: 3000,
      })
    );
  });

  it("V6: revalidatePath('/estoque') chamado após update", async () => {
    await updateVehicle("v-1", fd(validFields));
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("V7: lança erro se veículo não pertence à store", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateVehicle("v-outro", fd(validFields))).rejects.toThrow(
      "Veículo não encontrado"
    );
  });

  it("V7b: update não é chamado se ownership falha", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateVehicle("v-outro", fd(validFields))).rejects.toBeDefined();
    expect(chain.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// archiveVehicle
// ---------------------------------------------------------------------------

describe("archiveVehicle", () => {
  it("V8: define disponivel=false no veículo (soft delete)", async () => {
    const chain = makeChain();
    await archiveVehicle("v-1");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ disponivel: false })
    );
  });

  it("V9: revalidatePath('/estoque') chamado após arquivar", async () => {
    await archiveVehicle("v-1");
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("V10: lança erro se veículo não pertence à store", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(archiveVehicle("v-outro")).rejects.toThrow("Veículo não encontrado");
  });

  it("V10b: update não é chamado se ownership falha em archiveVehicle", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(archiveVehicle("v-outro")).rejects.toBeDefined();
    expect(chain.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// unarchiveVehicle
// ---------------------------------------------------------------------------

describe("unarchiveVehicle", () => {
  it("V11: define disponivel=true no veículo (restaura)", async () => {
    const chain = makeChain();
    await unarchiveVehicle("v-1");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ disponivel: true })
    );
  });

  it("V12: revalidatePath('/estoque') chamado após desarquivar", async () => {
    await unarchiveVehicle("v-1");
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("V13: lança erro se veículo não pertence à store", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(unarchiveVehicle("v-outro")).rejects.toThrow("Veículo não encontrado");
  });
});
