/**
 * Testes unitários para lib/opt-out.ts
 *
 * - isOptOutRequest: match exato (case/acento-insensitive), falso-positivo
 * - applyOptOutIfDetected: persiste marketing_opt_out + audit_logs, não-fatal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFrom, mockLogAudit } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

import { isOptOutRequest, applyOptOutIfDetected } from "@/lib/opt-out";

function chain(overrides: Record<string, unknown> = {}) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) c[k].mockResolvedValue(v);
  return c;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockLogAudit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("isOptOutRequest — frases da lista disparam", () => {
  it.each([
    "para",
    "Para",
    "PARE",
    "pare!",
    "pare.",
    "não quero mais",
    "nao quero mais",
    "descadastrar",
    "sair da lista",
    "não me manda mais",
    "  pare  ",
  ])("%s → true", (text) => {
    expect(isOptOutRequest(text)).toBe(true);
  });
});

describe("isOptOutRequest — falso-positivo (mensagem contém a palavra mas não é opt-out)", () => {
  it.each([
    "para de vender essa moto",
    "pare com isso, quero saber o preço",
    "não quero mais financiamento",
    "quero parar na loja hoje",
    "",
    "quero saber sobre a moto",
  ])("%s → false", (text) => {
    expect(isOptOutRequest(text)).toBe(false);
  });
});

describe("applyOptOutIfDetected", () => {
  it("texto sem match: não atualiza banco, retorna false", async () => {
    const result = await applyOptOutIfDetected({
      leadId: "lead-1",
      storeId: "store-1",
      text: "quero saber sobre a moto",
    });

    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("texto com match: atualiza leads.marketing_opt_out=true + marketing_opt_out_at", async () => {
    const updateChain = chain({ eq: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    const result = await applyOptOutIfDetected({
      leadId: "lead-1",
      storeId: "store-1",
      text: "pare",
    });

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("leads");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ marketing_opt_out: true })
    );
  });

  it("texto com match: grava audit_logs com action=lead.marketing_opt_out", async () => {
    mockFrom.mockReturnValueOnce(chain({ eq: { data: null, error: null } }));

    await applyOptOutIfDetected({ leadId: "lead-1", storeId: "store-1", text: "descadastrar" });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        userId: null,
        action: "lead.marketing_opt_out",
        resourceType: "lead",
        resourceId: "lead-1",
      })
    );
  });

  it("falha no update do banco: não lança, retorna false", async () => {
    mockFrom.mockReturnValueOnce(chain({ eq: { data: null, error: { message: "db error" } } }));

    const result = await applyOptOutIfDetected({ leadId: "lead-1", storeId: "store-1", text: "para" });

    expect(result).toBe(false);
  });
});
