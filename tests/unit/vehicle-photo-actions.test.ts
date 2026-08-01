import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — factories dos vi.mock()
// ---------------------------------------------------------------------------

const {
  mockFrom,
  mockStorageFrom,
  mockUpload,
  mockGetPublicUrl,
  mockRevalidate,
  mockGetServerStoreId,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockUpload: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
}));

vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { uploadVehiclePhotos } from "@/lib/vehicle-photo-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

type MockVehicle = { id: string; photo_url: string[] } | null;

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

function formDataWithFiles(files: File[]): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("photos", f);
  return fd;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  mockRevalidate.mockReset();
  mockFrom.mockReset();
  mockStorageFrom.mockReset();
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
  mockUpload.mockResolvedValue({ data: { path: "x" }, error: null });
  mockGetPublicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: `https://storage.example/vehicle-photos/${path}` },
  }));
  mockStorageFrom.mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("uploadVehiclePhotos", () => {
  it("veículo não encontrado (ou de outra loja) lança erro sem chamar storage", async () => {
    const { chain } = makeVehicleChain(null);
    mockFrom.mockReturnValue(chain);

    await expect(
      uploadVehiclePhotos("v-inexistente", formDataWithFiles([makeFile("a.jpg", "image/jpeg", 1024)]))
    ).rejects.toThrow(/não encontrado/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejeita lote sem arquivos válidos", async () => {
    const { chain, updateSpy } = makeVehicleChain({ id: "v1", photo_url: [] });
    mockFrom.mockReturnValue(chain);

    await expect(uploadVehiclePhotos("v1", new FormData())).rejects.toThrow(/selecione/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejeita arquivo de tipo inválido antes de chamar storage", async () => {
    const { chain } = makeVehicleChain({ id: "v1", photo_url: [] });
    mockFrom.mockReturnValue(chain);

    await expect(
      uploadVehiclePhotos("v1", formDataWithFiles([makeFile("doc.pdf", "application/pdf", 1024)]))
    ).rejects.toThrow(/tipo/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejeita arquivo acima do limite de tamanho antes de chamar storage", async () => {
    const { chain } = makeVehicleChain({ id: "v1", photo_url: [] });
    mockFrom.mockReturnValue(chain);

    await expect(
      uploadVehiclePhotos(
        "v1",
        formDataWithFiles([makeFile("big.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)])
      )
    ).rejects.toThrow(/grande/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejeita lote que excede MAX_PHOTOS_PER_VEHICLE somando com as já existentes", async () => {
    const existing = Array.from({ length: 9 }, (_, i) => `https://x/${i}.jpg`);
    const { chain } = makeVehicleChain({ id: "v1", photo_url: existing });
    mockFrom.mockReturnValue(chain);

    const files = [makeFile("a.jpg", "image/jpeg", 1024), makeFile("b.jpg", "image/jpeg", 1024)];
    await expect(uploadVehiclePhotos("v1", formDataWithFiles(files))).rejects.toThrow(/limite/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("faz upload de cada arquivo válido com path {store_id}/{vehicle_id}/... e persiste URLs no array", async () => {
    const { chain, updateSpy } = makeVehicleChain({ id: "v1", photo_url: ["https://x/old.jpg"] });
    mockFrom.mockReturnValue(chain);

    const files = [makeFile("a.jpg", "image/jpeg", 1024), makeFile("b.png", "image/png", 2048)];
    await uploadVehiclePhotos("v1", formDataWithFiles(files));

    expect(mockStorageFrom).toHaveBeenCalledWith("vehicle-photos");
    expect(mockUpload).toHaveBeenCalledTimes(2);
    const firstPath = mockUpload.mock.calls[0][0] as string;
    expect(firstPath).toMatch(/^store-1\/v1\//);
    expect(firstPath).toMatch(/a\.jpg$/);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        photo_url: [
          "https://x/old.jpg",
          "https://storage.example/vehicle-photos/" + mockUpload.mock.calls[0][0],
          "https://storage.example/vehicle-photos/" + mockUpload.mock.calls[1][0],
        ],
      })
    );
  });

  it("propaga erro do storage e não atualiza a tabela", async () => {
    const { chain, updateSpy } = makeVehicleChain({ id: "v1", photo_url: [] });
    mockFrom.mockReturnValue(chain);
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: "bucket down" } });

    await expect(
      uploadVehiclePhotos("v1", formDataWithFiles([makeFile("a.jpg", "image/jpeg", 1024)]))
    ).rejects.toThrow(/bucket down/);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("propaga erro do update da tabela mesmo com upload bem-sucedido", async () => {
    const { chain } = makeVehicleChain(
      { id: "v1", photo_url: [] },
      { error: new Error("db down") }
    );
    mockFrom.mockReturnValue(chain);

    await expect(
      uploadVehiclePhotos("v1", formDataWithFiles([makeFile("a.jpg", "image/jpeg", 1024)]))
    ).rejects.toThrow();
  });

  it("revalida /estoque após sucesso", async () => {
    const { chain } = makeVehicleChain({ id: "v1", photo_url: [] });
    mockFrom.mockReturnValue(chain);

    await uploadVehiclePhotos("v1", formDataWithFiles([makeFile("a.jpg", "image/jpeg", 1024)]));

    expect(mockRevalidate).toHaveBeenCalledWith("/estoque");
  });

  it("ignora entradas de arquivo vazio (input file sem seleção real)", async () => {
    const { chain, updateSpy } = makeVehicleChain({ id: "v1", photo_url: [] });
    mockFrom.mockReturnValue(chain);

    const fd = formDataWithFiles([makeFile("a.jpg", "image/jpeg", 1024)]);
    fd.append("photos", makeFile("", "application/octet-stream", 0));

    await uploadVehiclePhotos("v1", fd);

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalled();
  });
});
