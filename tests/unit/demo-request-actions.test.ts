import { describe, it, expect, vi, beforeEach } from "vitest";
import { HONEYPOT_FIELD_NAME } from "@/lib/public-contact-honeypot";

const { mockFrom, mockInsert } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import { createDemoRequest } from "@/lib/demo-request-actions";

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createDemoRequest — Server Action da landing page (roadmap 1.7)", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it("DRA-1: input válido grava em demo_requests e retorna success", async () => {
    const fd = buildFormData({
      nome: "Vitor",
      empresa: "Speed Motos",
      telefone: "+5511999990000",
    });

    const result = await createDemoRequest({ status: "idle" }, fd);

    expect(result).toEqual({ status: "success" });
    expect(mockFrom).toHaveBeenCalledWith("demo_requests");
    expect(mockInsert).toHaveBeenCalledWith({
      nome: "Vitor",
      empresa: "Speed Motos",
      telefone: "+5511999990000",
      email: null,
      mensagem: null,
    });
  });

  it("DRA-2: honeypot preenchido finge sucesso sem gravar", async () => {
    const fd = buildFormData({
      nome: "Bot",
      empresa: "Bot Inc",
      telefone: "0000",
      [HONEYPOT_FIELD_NAME]: "preenchido-por-bot",
    });

    const result = await createDemoRequest({ status: "idle" }, fd);

    expect(result).toEqual({ status: "success" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("DRA-3: nome ausente retorna erro sem gravar", async () => {
    const fd = buildFormData({
      nome: "",
      empresa: "Speed Motos",
      telefone: "+5511999990000",
    });

    const result = await createDemoRequest({ status: "idle" }, fd);

    expect(result).toEqual({ status: "error", message: "Informe seu nome." });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("DRA-4: falha no insert retorna erro genérico", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    const fd = buildFormData({
      nome: "Vitor",
      empresa: "Speed Motos",
      telefone: "+5511999990000",
    });

    const result = await createDemoRequest({ status: "idle" }, fd);

    expect(result).toEqual({
      status: "error",
      message: "Não foi possível enviar. Tente novamente.",
    });
  });

  it("DRA-5: email e mensagem opcionais são gravados quando presentes", async () => {
    const fd = buildFormData({
      nome: "Vitor",
      empresa: "Speed Motos",
      telefone: "+5511999990000",
      email: "vitor@speedmotos.com.br",
      mensagem: "Quero conhecer",
    });

    await createDemoRequest({ status: "idle" }, fd);

    expect(mockInsert).toHaveBeenCalledWith({
      nome: "Vitor",
      empresa: "Speed Motos",
      telefone: "+5511999990000",
      email: "vitor@speedmotos.com.br",
      mensagem: "Quero conhecer",
    });
  });
});
