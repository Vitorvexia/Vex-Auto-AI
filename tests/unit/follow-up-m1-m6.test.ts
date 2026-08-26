/**
 * Testes unitários — BL-0040/DL-0021, parte follow-up:
 * - M1: texto livre dentro da janela de 24h, template fora dela
 * - Gate de elegibilidade (canSendMarketingMessage) integrado no job
 * - Bookkeeping: last_marketing_sent_at e follow_up_completed_at (3ª tentativa)
 * - M6: markFollowUpCompletedIfInterrupted
 *
 * TEMPLATE_SEND_ENABLED fica no default (false/ausente) neste arquivo —
 * caminho "template ligado" já é coberto por follow-up-template-send.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFrom, mockRpc, mockSendText, mockSendTemplate, mockGetPhoneId } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSendText: vi.fn(),
  mockSendTemplate: vi.fn(),
  mockGetPhoneId: vi.fn(),
}));

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

import { runFollowUpJob, markFollowUpCompletedIfInterrupted } from "@/lib/follow-up";

function chain(overrides: Record<string, unknown> = {}) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    match: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) c[k].mockResolvedValue(v);
  return c;
}

const NOW = new Date("2026-08-26T15:00:00.000Z"); // meio-dia BRT

const BASE_CONV = {
  conversation_id: "conv-1",
  store_id: "store-1",
  lead_id: "lead-1",
  nome: "Carlos",
  phone_normalized: "+5511999990001",
  attempt_count: 0,
  last_inbound_at: NOW.toISOString(), // dentro da janela por padrão
  last_marketing_sent_at: null as string | null,
  business_hours_start: "08:00",
  business_hours_end: "20:00",
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

// ---------------------------------------------------------------------------
// M1 — janela de sessão
// ---------------------------------------------------------------------------

describe("runFollowUpJob — M1 janela de sessão", () => {
  it("dentro de 24h desde last_inbound_at: envia texto livre (sendWhatsAppMessage)", async () => {
    mockRpc.mockResolvedValueOnce({ data: [BASE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockSendText.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages

    const result = await runFollowUpJob({ now: NOW });

    expect(mockSendText).toHaveBeenCalledTimes(1);
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 1, skipped: 0, failed: 0 });
  });

  it("fora de 24h desde last_inbound_at, template desligado: skip sem consumir tentativa (não chama WA, não insere log)", async () => {
    const conv = { ...BASE_CONV, last_inbound_at: null };
    mockRpc.mockResolvedValueOnce({ data: [conv], error: null });

    const result = await runFollowUpJob({ now: NOW });

    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    // Nenhum claim inserido — só a chamada de RPC acontece.
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, sent: 0, skipped: 1, failed: 0 });
  });

  it("last_inbound_at exatamente 24h atrás: já fora da janela (limite exclusivo)", async () => {
    const conv = { ...BASE_CONV, last_inbound_at: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString() };
    mockRpc.mockResolvedValueOnce({ data: [conv], error: null });

    const result = await runFollowUpJob({ now: NOW });

    expect(mockSendText).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Gate de elegibilidade (canSendMarketingMessage) integrado no job
// ---------------------------------------------------------------------------

describe("runFollowUpJob — gate de elegibilidade", () => {
  it("trava de frequência (last_marketing_sent_at < 48h): skip, não consome tentativa", async () => {
    const conv = { ...BASE_CONV, last_marketing_sent_at: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString() };
    mockRpc.mockResolvedValueOnce({ data: [conv], error: null });

    const result = await runFollowUpJob({ now: NOW });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, skipped: 1, sent: 0, failed: 0 });
  });

  it("fora do horário comercial da loja: skip, não consome tentativa", async () => {
    const sixAmBrt = new Date("2026-08-26T09:00:00.000Z");
    mockRpc.mockResolvedValueOnce({ data: [BASE_CONV], error: null });

    const result = await runFollowUpJob({ now: sixAmBrt });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, skipped: 1, sent: 0, failed: 0 });
  });
});

// ---------------------------------------------------------------------------
// Bookkeeping: last_marketing_sent_at / follow_up_completed_at
// ---------------------------------------------------------------------------

describe("runFollowUpJob — bookkeeping pós-envio", () => {
  it("attempt 3 (última tentativa): grava follow_up_completed_at em leads", async () => {
    const conv = { ...BASE_CONV, attempt_count: 2 };
    mockRpc.mockResolvedValueOnce({ data: [conv], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockSendText.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages
    const marketingSentChain = chain({ eq: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(marketingSentChain); // last_marketing_sent_at
    const completedChain = chain({ is: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(completedChain); // follow_up_completed_at

    await runFollowUpJob({ now: NOW });

    expect(completedChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ follow_up_completed_at: NOW.toISOString() })
    );
  });

  it("attempt 1: NÃO grava follow_up_completed_at (só last_marketing_sent_at)", async () => {
    mockRpc.mockResolvedValueOnce({ data: [BASE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendText.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    const marketingSentChain = chain({ eq: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(marketingSentChain);

    await runFollowUpJob({ now: NOW });

    expect(marketingSentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_marketing_sent_at: NOW.toISOString() })
    );
    // Só 3 chamadas .from(): claim, messages, last_marketing_sent_at — sem follow_up_completed_at
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("falha no bookkeeping (leads update) não vira 'failed' pro job — envio já confirmado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [BASE_CONV], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendText.mockResolvedValueOnce(undefined);
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    // .from("leads") retorna undefined (não configurado) → update() lançaria — deve ser engolido

    const result = await runFollowUpJob({ now: NOW });

    expect(result).toMatchObject({ sent: 1, failed: 0 });
  });
});

// ---------------------------------------------------------------------------
// M6 — markFollowUpCompletedIfInterrupted
// ---------------------------------------------------------------------------

describe("markFollowUpCompletedIfInterrupted", () => {
  it("sem tentativas de follow-up na conversa: não atualiza leads", async () => {
    mockFrom.mockReturnValueOnce(chain({ limit: { data: [], error: null } }));

    await markFollowUpCompletedIfInterrupted("lead-1", "conv-1");

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("follow_up_logs");
  });

  it("com tentativa registrada: grava follow_up_completed_at só se ainda nulo (is filter)", async () => {
    mockFrom.mockReturnValueOnce(chain({ limit: { data: [{ id: "log-1" }], error: null } }));
    const updateChain = chain({ is: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(updateChain);

    await markFollowUpCompletedIfInterrupted("lead-1", "conv-1");

    expect(mockFrom).toHaveBeenNthCalledWith(2, "leads");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ follow_up_completed_at: expect.any(String) })
    );
    expect(updateChain.is).toHaveBeenCalledWith("follow_up_completed_at", null);
  });

  it("erro na leitura de follow_up_logs: não lança, não atualiza leads", async () => {
    mockFrom.mockReturnValueOnce(chain({ limit: { data: null, error: { message: "db down" } } }));

    await expect(markFollowUpCompletedIfInterrupted("lead-1", "conv-1")).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
