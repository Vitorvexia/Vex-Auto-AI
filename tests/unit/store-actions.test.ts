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
  mockGetServerUserRole,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockUpload: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
  mockGetServerUserRole: vi.fn(),
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
  getServerUserRole: mockGetServerUserRole,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { updateStoreSettings, uploadStoreLogo } from "@/lib/store-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

function makeUpdateChain(result: { error: unknown } = { error: null }) {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn().mockReturnValue({ eq });
  return { update, eq };
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  mockGetServerUserRole.mockResolvedValue("dono_loja");
  mockRevalidate.mockReset();
  mockFrom.mockReset();
  mockStorageFrom.mockReset();
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
  mockUpload.mockResolvedValue({ data: { path: "x" }, error: null });
  mockGetPublicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: `https://storage.example/store-logos/${path}` },
  }));
  mockStorageFrom.mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// updateStoreSettings
// ---------------------------------------------------------------------------

describe("updateStoreSettings", () => {
  it("vendedor não pode editar configurações da loja", async () => {
    mockGetServerUserRole.mockResolvedValue("vendedor");

    await expect(
      updateStoreSettings(fd({ cor_primaria: "#FF0000" }))
    ).rejects.toThrow(/dono da loja/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("dono_loja pode editar", async () => {
    const { update, eq } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await updateStoreSettings(
      fd({
        cor_primaria: "#FF0000",
        telefone_publico: "+55 11 99999-0000",
        endereco: "Rua A, 123",
        sobre: "Loja de motos usadas.",
      })
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        cor_primaria: "#FF0000",
        telefone_publico: "+55 11 99999-0000",
        endereco: "Rua A, 123",
        sobre: "Loja de motos usadas.",
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "store-1");
  });

  it("super_admin pode editar", async () => {
    mockGetServerUserRole.mockResolvedValue("super_admin");
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await updateStoreSettings(fd({ cor_primaria: "#00FF00" }));

    expect(update).toHaveBeenCalled();
  });

  it("rejeita cor_primaria fora do formato hex", async () => {
    await expect(
      updateStoreSettings(fd({ cor_primaria: "vermelho" }))
    ).rejects.toThrow(/cor/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("cor_primaria vazia limpa o campo (null)", async () => {
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await updateStoreSettings(fd({ cor_primaria: "" }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ cor_primaria: null }));
  });

  it("aplica sanitizeStoreText nos campos de texto (trim)", async () => {
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await updateStoreSettings(fd({ telefone_publico: "  +55 11 99999-0000  " }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ telefone_publico: "+55 11 99999-0000" })
    );
  });

  it("propaga erro do update", async () => {
    const { update } = makeUpdateChain({ error: new Error("db down") });
    mockFrom.mockReturnValue({ update });

    await expect(updateStoreSettings(fd({ cor_primaria: "#FF0000" }))).rejects.toThrow();
  });

  it("revalida /configuracoes e o site público após sucesso", async () => {
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await updateStoreSettings(fd({ cor_primaria: "#FF0000" }));

    expect(mockRevalidate).toHaveBeenCalledWith("/configuracoes");
  });
});

// ---------------------------------------------------------------------------
// uploadStoreLogo
// ---------------------------------------------------------------------------

describe("uploadStoreLogo", () => {
  function logoFd(file: File): FormData {
    const f = new FormData();
    f.append("logo", file);
    return f;
  }

  it("vendedor não pode subir logo", async () => {
    mockGetServerUserRole.mockResolvedValue("vendedor");

    await expect(
      uploadStoreLogo(logoFd(makeFile("logo.png", "image/png", 1024)))
    ).rejects.toThrow(/dono da loja/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejeita arquivo de tipo inválido antes de chamar storage", async () => {
    await expect(
      uploadStoreLogo(logoFd(makeFile("logo.pdf", "application/pdf", 1024)))
    ).rejects.toThrow(/tipo/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejeita arquivo acima de 2MB", async () => {
    await expect(
      uploadStoreLogo(logoFd(makeFile("logo.png", "image/png", 2 * 1024 * 1024 + 1)))
    ).rejects.toThrow(/grande/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejeita quando nenhum arquivo é enviado", async () => {
    await expect(uploadStoreLogo(new FormData())).rejects.toThrow(/selecione/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("sobe com path fixo {store_id}/logo.{ext} e upsert:true", async () => {
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await uploadStoreLogo(logoFd(makeFile("qualquer-nome.png", "image/png", 1024)));

    expect(mockStorageFrom).toHaveBeenCalledWith("store-logos");
    expect(mockUpload).toHaveBeenCalledWith(
      "store-1/logo.png",
      expect.anything(),
      expect.objectContaining({ contentType: "image/png", upsert: true })
    );
  });

  it("deriva extensão correta pra jpeg", async () => {
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await uploadStoreLogo(logoFd(makeFile("a.jpg", "image/jpeg", 1024)));

    expect(mockUpload).toHaveBeenCalledWith(
      "store-1/logo.jpg",
      expect.anything(),
      expect.anything()
    );
  });

  it("persiste logo_url após upload", async () => {
    const { update, eq } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await uploadStoreLogo(logoFd(makeFile("logo.webp", "image/webp", 1024)));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_url: "https://storage.example/store-logos/store-1/logo.webp",
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "store-1");
  });

  it("propaga erro do storage e não atualiza a tabela", async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: "bucket down" } });

    await expect(
      uploadStoreLogo(logoFd(makeFile("logo.png", "image/png", 1024)))
    ).rejects.toThrow(/bucket down/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("revalida /configuracoes após sucesso", async () => {
    const { update } = makeUpdateChain();
    mockFrom.mockReturnValue({ update });

    await uploadStoreLogo(logoFd(makeFile("logo.png", "image/png", 1024)));

    expect(mockRevalidate).toHaveBeenCalledWith("/configuracoes");
  });
});
