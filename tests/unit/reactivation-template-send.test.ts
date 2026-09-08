/**
 * Testa o caminho de envio por template em runReactivationJob quando
 * WHATSAPP_TEMPLATE_SEND_ENABLED=true — arquivo separado de reactivation.test.ts
 * pelo mesmo motivo de tests/unit/follow-up-template-send.test.ts: a flag é lida
 * do env em module-load time, precisa estar setada ANTES do import (dentro de
 * vi.hoisted(), já que imports ESM são hoisted acima de código solto).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFrom, mockRpc, mockSendText, mockSendTemplate, mockGetPhoneId } = vi.hoisted(() => {
  process.env.WHATSAPP_TEMPLATE_SEND_ENABLED = "true";
  return {
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
    mockSendText: vi.fn(),
    mockSendTemplate: vi.fn(),
    mockGetPhoneId: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}));

vi.mock("@/lib/whatsapp-send", () => ({
  sendWhatsAppMessage: mockSendText,
  sendWhatsAppTemplateMessage: mockSendTemplate,
  WhatsAppSendError: class WhatsAppSendError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "WhatsAppSendError";
    }
  },
}));

vi.mock("@/lib/whatsapp-credentials", () => ({
  getStoreWhatsAppPhoneId: mockGetPhoneId,
}));

import { runReactivationJob } from "@/lib/reactivation";

function chain(overrides: Record<string, unknown> = {}) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    match: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) c[k].mockResolvedValue(v);
  return c;
}

const ELIGIBLE_LEAD = {
  lead_id: "lead-1",
  store_id: "store-1",
  conversation_id: "conv-1",
  nome: "Carlos",
  phone_normalized: "+5511999990001",
  attempt_count: 0,
  veiculo_interesse: null as string | null,
  // Fora da janela de sessão (força caminho de template, que é o que este
  // arquivo testa) + fora de qualquer gate de elegibilidade.
  last_inbound_at: null as string | null,
  last_marketing_sent_at: null as string | null,
  business_hours_start: "00:00",
  business_hours_end: "23:59",
};

beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = "tok";
  mockGetPhoneId.mockResolvedValue("123456");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.WHATSAPP_ACCESS_TOKEN;
});

describe("runReactivationJob — WHATSAPP_TEMPLATE_SEND_ENABLED=true", () => {
  it("chama sendWhatsAppTemplateMessage (não sendWhatsAppMessage) quando flag ligada", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages
    mockSendTemplate.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(mockSendTemplate).toHaveBeenCalledOnce();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it("sem veículo → templateName=reactivation_no_vehicle_1, params=[nome]", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(mockSendTemplate).toHaveBeenCalledWith(
      "+5511999990001",
      "reactivation_no_vehicle_1",
      "pt_BR",
      ["Carlos"],
      "123456"
    );
  });

  it("com veículo → templateName=reactivation_vehicle_1, params=[nome, veiculo] na ordem", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ ...ELIGIBLE_LEAD, veiculo_interesse: "Honda Civic 2020" }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(mockSendTemplate).toHaveBeenCalledWith(
      "+5511999990001",
      "reactivation_vehicle_1",
      "pt_BR",
      ["Carlos", "Honda Civic 2020"],
      "123456"
    );
  });

  it("attempt 3 com veículo → reactivation_vehicle_3", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ ...ELIGIBLE_LEAD, attempt_count: 2, veiculo_interesse: "VW Gol" }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    expect(mockSendTemplate).toHaveBeenCalledWith(
      "+5511999990001",
      "reactivation_vehicle_3",
      "pt_BR",
      ["Carlos", "VW Gol"],
      "123456"
    );
  });

  it("texto salvo em messages.mensagem bate com os parâmetros do template (nome e veículo idênticos)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ ...ELIGIBLE_LEAD, veiculo_interesse: "Toyota Corolla" }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    const msgChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(msgChain); // messages
    mockSendTemplate.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    const savedText = msgChain.insert.mock.calls[0][0].mensagem as string;
    const templateParams = mockSendTemplate.mock.calls[0][3] as string[];
    expect(savedText).toContain(templateParams[0]); // nome
    expect(savedText).toContain(templateParams[1]); // veículo
  });

  it("nome null → 'você' tanto no texto salvo quanto no parâmetro do template", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_LEAD, nome: null }], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    const msgChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(msgChain);
    mockSendTemplate.mockResolvedValueOnce(undefined);

    await runReactivationJob();

    const savedText = msgChain.insert.mock.calls[0][0].mensagem as string;
    const templateParams = mockSendTemplate.mock.calls[0][3] as string[];
    expect(templateParams[0]).toBe("você");
    expect(savedText).toContain("você");
  });

  it("falha de template (não aprovado) é registrada como failed, igual falha de texto", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages
    mockSendTemplate.mockRejectedValueOnce(
      new Error("WhatsApp API retornou 400 (template=reactivation_no_vehicle_1)")
    );
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    const result = await runReactivationJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("template não aprovado grava error_message identificando o template — não fica silenciosa", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages
    mockSendTemplate.mockRejectedValueOnce(
      new Error("WhatsApp API retornou 400 (template=reactivation_no_vehicle_1)")
    );
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await runReactivationJob();

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "WhatsApp API retornou 400 (template=reactivation_no_vehicle_1)",
      })
    );
  });
});
