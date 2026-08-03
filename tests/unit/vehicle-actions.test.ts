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

import {
  createVehicle,
  updateVehicle,
  archiveVehicle,
  unarchiveVehicle,
  publishVehicle,
  unpublishVehicle,
} from "@/lib/vehicle-actions";

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

// ---------------------------------------------------------------------------
// publishVehicle / unpublishVehicle (roadmap 1.4 — publicado no site)
// ---------------------------------------------------------------------------

describe("unpublishVehicle", () => {
  it("V14: define publicado=false no veículo", async () => {
    const chain = makeChain();
    await unpublishVehicle("v-1");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ publicado: false })
    );
  });

  it("V15: revalidatePath('/estoque') chamado após ocultar do site", async () => {
    await unpublishVehicle("v-1");
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("V16: lança erro se veículo não pertence à store", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(unpublishVehicle("v-outro")).rejects.toThrow("Veículo não encontrado");
  });

  it("V16b: update não é chamado se ownership falha em unpublishVehicle", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(unpublishVehicle("v-outro")).rejects.toBeDefined();
    expect(chain.update).not.toHaveBeenCalled();
  });
});

describe("publishVehicle", () => {
  it("V17: define publicado=true no veículo (restaura exposição no site)", async () => {
    const chain = makeChain();
    await publishVehicle("v-1");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ publicado: true })
    );
  });

  it("V18: revalidatePath('/estoque') chamado após republicar", async () => {
    await publishVehicle("v-1");
    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("V19: lança erro se veículo não pertence à store", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(publishVehicle("v-outro")).rejects.toThrow("Veículo não encontrado");
  });
});

// ---------------------------------------------------------------------------
// Validação de margem (createVehicle + updateVehicle)
// ---------------------------------------------------------------------------

describe("validação de margem", () => {
  it("V-M1: createVehicle lança erro se preco igual ao custo", async () => {
    await expect(
      createVehicle(fd({ ...validFields, preco: "75000", custo: "75000" }))
    ).rejects.toThrow("Preço deve ser maior que o custo");
  });

  it("V-M2: createVehicle lança erro se preco menor que custo", async () => {
    await expect(
      createVehicle(fd({ ...validFields, preco: "70000", custo: "75000" }))
    ).rejects.toThrow("Preço deve ser maior que o custo");
  });

  it("V-M3: createVehicle lança erro se margem_minima maior que lucro bruto (preco - custo)", async () => {
    await expect(
      createVehicle(fd({ ...validFields, margem_minima: "20000" }))
    ).rejects.toThrow("Margem mínima não pode ser maior que o lucro bruto");
  });

  it("V-M4: createVehicle não chama insert quando validação de margem falha", async () => {
    const chain = makeChain();
    await expect(
      createVehicle(fd({ ...validFields, preco: "70000", custo: "75000" }))
    ).rejects.toBeDefined();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("V-M5: updateVehicle lança erro se preco igual ao custo", async () => {
    await expect(
      updateVehicle("v-1", fd({ ...validFields, preco: "75000", custo: "75000" }))
    ).rejects.toThrow("Preço deve ser maior que o custo");
  });

  it("V-M6: updateVehicle lança erro se margem_minima maior que lucro bruto (preco - custo)", async () => {
    await expect(
      updateVehicle("v-1", fd({ ...validFields, margem_minima: "20000" }))
    ).rejects.toThrow("Margem mínima não pode ser maior que o lucro bruto");
  });

  it("V-M7: updateVehicle não chama update quando validação de margem falha", async () => {
    const chain = makeChain();
    await expect(
      updateVehicle("v-1", fd({ ...validFields, preco: "70000", custo: "75000" }))
    ).rejects.toBeDefined();
    expect(chain.update).not.toHaveBeenCalled();
  });

  // Regression: V-M8/V-M9 — updateVehicle missing isNaN guards for preco/custo
  // Found by /qa on 2026-06-15
  // Report: PR #26 review — createVehicle validates all 3 numerics, updateVehicle was missing preco/custo guards
  it("V-M8: updateVehicle lança erro se preco for NaN (string inválida)", async () => {
    await expect(
      updateVehicle("v-1", fd({ ...validFields, preco: "nao-e-numero" }))
    ).rejects.toThrow("Valores numéricos inválidos");
  });

  it("V-M9: updateVehicle lança erro se custo for NaN (string inválida)", async () => {
    await expect(
      updateVehicle("v-1", fd({ ...validFields, custo: "nao-e-numero" }))
    ).rejects.toThrow("Valores numéricos inválidos");
  });
});
