/**
 * Testa o caminho de envio por template em runFollowUpJob quando
 * WHATSAPP_TEMPLATE_SEND_ENABLED=true — arquivo separado de follow-up.test.ts
 * porque a flag é lida do env em module-load time (`const TEMPLATE_SEND_ENABLED =
 * process.env...` no topo de lib/follow-up.ts), então precisa estar setada
 * ANTES do import do módulo. follow-up.test.ts cobre o caminho flag-off
 * (comportamento padrão/atual, sem tocar nesse arquivo).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// process.env.* precisa estar dentro de vi.hoisted() pra rodar ANTES do import
// de lib/follow-up.ts — imports ESM são hoisted acima de código solto no topo
// do arquivo, então uma atribuição "solta" aqui rodaria só depois do módulo
// já ter lido `TEMPLATE_SEND_ENABLED` (e portanto tarde demais).
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

import { runFollowUpJob } from "@/lib/follow-up";

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

const ELIGIBLE_CONV = {
  conversation_id: "conv-1",
  store_id: "store-1",
  lead_id: "lead-1",
  nome: "Carlos",
  phone_normalized: "+5511999990001",
  attempt_count: 0,
  // Fora da janela de sessão (força caminho de template, que é o que este
  // arquivo testa) + fora de qualquer gate de elegibilidade — determinístico
  // independente do horário real em que o teste roda.
  last_inbound_at: null,
  last_marketing_sent_at: null,
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

describe("runFollowUpJob — WHATSAPP_TEMPLATE_SEND_ENABLED=true", () => {
  it("chama sendWhatsAppTemplateMessage (não sendWhatsAppMessage) quando flag ligada", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    expect(mockSendTemplate).toHaveBeenCalledOnce();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it("chama com templateName=follow_up_1 e params=[nome] pra attempt 1", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    expect(mockSendTemplate).toHaveBeenCalledWith(
      "+5511999990001",
      "follow_up_1",
      "pt_BR",
      ["Carlos"],
      "123456"
    );
  });

  it("attempt 2 (1 tentativa anterior) → templateName=follow_up_2", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_CONV, attempt_count: 1 }], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));

    await runFollowUpJob();

    expect(mockSendTemplate).toHaveBeenCalledWith(
      "+5511999990001",
      "follow_up_2",
      "pt_BR",
      ["Carlos"],
      "123456"
    );
  });

  it("texto salvo em messages.mensagem bate com o parâmetro do template (nome idêntico)", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);
    const msgChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(msgChain);

    await runFollowUpJob();

    const savedText = msgChain.insert.mock.calls[0][0].mensagem as string;
    const templateParams = mockSendTemplate.mock.calls[0][3] as string[];
    expect(savedText).toContain(templateParams[0]); // nome usado no texto == {{1}} do template
  });

  it("nome null → 'você' tanto no texto salvo quanto no parâmetro do template", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...ELIGIBLE_CONV, nome: null }], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockResolvedValueOnce(undefined);
    const msgChain = chain({ insert: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(msgChain);

    await runFollowUpJob();

    const savedText = msgChain.insert.mock.calls[0][0].mensagem as string;
    const templateParams = mockSendTemplate.mock.calls[0][3] as string[];
    expect(templateParams).toEqual(["você"]);
    expect(savedText).toContain("você");
  });

  it("falha de template (não aprovado) é registrada como failed, igual falha de texto", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockRejectedValueOnce(new Error("WhatsApp API retornou 400 (template=follow_up_1)"));
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    const result = await runFollowUpJob();

    expect(result).toMatchObject({ processed: 1, sent: 0, failed: 1 });
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("template não aprovado grava error_message identificando o template — não fica silenciosa", async () => {
    mockRpc.mockResolvedValueOnce({ data: [ELIGIBLE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendTemplate.mockRejectedValueOnce(
      new Error("WhatsApp API retornou 400 (template=follow_up_1)")
    );
    const updateChain = chain({ match: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await runFollowUpJob();

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "WhatsApp API retornou 400 (template=follow_up_1)",
      })
    );
  });
});
