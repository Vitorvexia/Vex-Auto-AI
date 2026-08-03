/**
 * lib/public-contact.ts — Server Action do formulário de contato do site
 * público da loja (roadmap 1.4). Cria lead via ingestLeadManually com
 * origem="site". Honeypot descarta envio de bot silenciosamente (sem erro
 * visível, sem persistir nada).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockResolveStoreIdBySlug, mockIngestLeadManually } = vi.hoisted(() => ({
  mockResolveStoreIdBySlug: vi.fn(),
  mockIngestLeadManually: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {},
}));

vi.mock("@/lib/public-store", () => ({
  resolveStoreIdBySlug: mockResolveStoreIdBySlug,
}));

vi.mock("@/lib/lead-ingestion", () => ({
  ingestLeadManually: mockIngestLeadManually,
}));

import { submitPublicContactLead } from "@/lib/public-contact";
import { HONEYPOT_FIELD_NAME } from "@/lib/public-contact-honeypot";

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

beforeEach(() => {
  mockResolveStoreIdBySlug.mockResolvedValue("store-1");
  mockIngestLeadManually.mockResolvedValue({
    status: "created",
    leadId: "lead-1",
    conversationId: "conv-1",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitPublicContactLead — honeypot", () => {
  it("PC-1: honeypot preenchido descarta o envio silenciosamente — sucesso fingido, sem criar lead", async () => {
    const result = await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "Bot", telefone: "+5511999990000", [HONEYPOT_FIELD_NAME]: "http://spam.com" })
    );

    expect(result.status).toBe("success");
    expect(mockIngestLeadManually).not.toHaveBeenCalled();
    expect(mockResolveStoreIdBySlug).not.toHaveBeenCalled();
  });

  it("PC-2: honeypot vazio segue fluxo normal (cria lead)", async () => {
    await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "João", telefone: "+5511999990000", [HONEYPOT_FIELD_NAME]: "" })
    );

    expect(mockIngestLeadManually).toHaveBeenCalled();
  });
});

describe("submitPublicContactLead — validação e criação de lead", () => {
  it("PC-3: nome vazio retorna erro sem chamar ingestLeadManually", async () => {
    const result = await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "", telefone: "+5511999990000" })
    );

    expect(result.status).toBe("error");
    expect(mockIngestLeadManually).not.toHaveBeenCalled();
  });

  it("PC-4: telefone vazio retorna erro sem chamar ingestLeadManually", async () => {
    const result = await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "João", telefone: "" })
    );

    expect(result.status).toBe("error");
    expect(mockIngestLeadManually).not.toHaveBeenCalled();
  });

  it("PC-5: slug não resolve loja — retorna erro sem chamar ingestLeadManually", async () => {
    mockResolveStoreIdBySlug.mockResolvedValue(null);

    const result = await submitPublicContactLead(
      "loja-inexistente",
      { status: "idle" },
      fd({ nome: "João", telefone: "+5511999990000" })
    );

    expect(result.status).toBe("error");
    expect(mockIngestLeadManually).not.toHaveBeenCalled();
  });

  it("PC-6: chama ingestLeadManually com origem 'site' e storeId resolvido do slug", async () => {
    await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "João", telefone: "+5511999990000", mensagem: "Quero saber mais" })
    );

    expect(mockResolveStoreIdBySlug).toHaveBeenCalledWith(expect.anything(), "speedmotos");
    expect(mockIngestLeadManually).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "João",
        telefone: "+5511999990000",
        origem: "site",
        observacao: "Quero saber mais",
        storeId: "store-1",
      })
    );
  });

  it("PC-7: mensagem opcional ausente vira null, não string vazia", async () => {
    await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "João", telefone: "+5511999990000" })
    );

    expect(mockIngestLeadManually).toHaveBeenCalledWith(
      expect.objectContaining({ observacao: null })
    );
  });

  it("PC-8: ingestLeadManually retorna invalid_phone — Server Action reporta erro", async () => {
    mockIngestLeadManually.mockResolvedValue({ status: "invalid_phone" });

    const result = await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "João", telefone: "123" })
    );

    expect(result.status).toBe("error");
  });

  it("PC-9: sucesso (created ou existing) retorna status success", async () => {
    mockIngestLeadManually.mockResolvedValue({
      status: "existing",
      leadId: "lead-1",
      conversationId: null,
    });

    const result = await submitPublicContactLead(
      "speedmotos",
      { status: "idle" },
      fd({ nome: "João", telefone: "+5511999990000" })
    );

    expect(result.status).toBe("success");
  });
});
