/**
 * Testes unitários — BL-0040/DL-0021, parte reativação:
 * - M1: texto livre dentro da janela de 24h, template fora dela
 * - Gate de elegibilidade (canSendMarketingMessage) integrado no job
 * - Bookkeeping: last_marketing_sent_at após envio
 *
 * TEMPLATE_SEND_ENABLED fica no default (false/ausente) — caminho "template
 * ligado" já é coberto por reactivation-template-send.test.ts.
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

import { runReactivationJob } from "@/lib/reactivation";

function chain(overrides: Record<string, unknown> = {}) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    match: vi.fn(),
  };
  for (const k of Object.keys(c)) c[k].mockReturnValue(c);
  for (const [k, v] of Object.entries(overrides)) c[k].mockResolvedValue(v);
  return c;
}

const NOW = new Date("2026-08-26T15:00:00.000Z"); // meio-dia BRT

const BASE_LEAD = {
  lead_id: "lead-1",
  store_id: "store-1",
  conversation_id: "conv-1",
  nome: "Carlos",
  phone_normalized: "+5511999990001",
  attempt_count: 0,
  veiculo_interesse: null as string | null,
  last_inbound_at: NOW.toISOString(),
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

describe("runReactivationJob — M1 janela de sessão", () => {
  it("dentro de 24h desde last_inbound_at: envia texto livre", async () => {
    mockRpc.mockResolvedValueOnce({ data: [BASE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages
    mockSendText.mockResolvedValueOnce(undefined);

    const result = await runReactivationJob({ now: NOW });

    expect(mockSendText).toHaveBeenCalledTimes(1);
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 1, skipped: 0, failed: 0 });
  });

  it("fora de 24h, template desligado: skip sem consumir tentativa (sem claim)", async () => {
    const lead = { ...BASE_LEAD, last_inbound_at: null };
    mockRpc.mockResolvedValueOnce({ data: [lead], error: null });

    const result = await runReactivationJob({ now: NOW });

    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, sent: 0, skipped: 1, failed: 0 });
  });
});

describe("runReactivationJob — gate de elegibilidade", () => {
  it("opt-out via frequência (last_marketing_sent_at recente): skip, não consome tentativa", async () => {
    const lead = { ...BASE_LEAD, last_marketing_sent_at: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString() };
    mockRpc.mockResolvedValueOnce({ data: [lead], error: null });

    const result = await runReactivationJob({ now: NOW });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, skipped: 1, sent: 0, failed: 0 });
  });

  it("fora do horário comercial: skip, não consome tentativa", async () => {
    const ninePmBrt = new Date("2026-08-27T00:00:00.000Z"); // 21h BRT
    mockRpc.mockResolvedValueOnce({ data: [BASE_LEAD], error: null });

    const result = await runReactivationJob({ now: ninePmBrt });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, skipped: 1, sent: 0, failed: 0 });
  });
});

describe("runReactivationJob — bookkeeping pós-envio", () => {
  it("envio com sucesso: grava last_marketing_sent_at em leads", async () => {
    mockRpc.mockResolvedValueOnce({ data: [BASE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // claim
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } })); // messages
    mockSendText.mockResolvedValueOnce(undefined);
    const marketingSentChain = chain({ eq: { data: null, error: null } });
    mockFrom.mockReturnValueOnce(marketingSentChain);

    await runReactivationJob({ now: NOW });

    expect(mockFrom).toHaveBeenNthCalledWith(3, "leads");
    expect(marketingSentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_marketing_sent_at: NOW.toISOString() })
    );
  });

  it("falha no bookkeeping não vira 'failed' — envio já confirmado", async () => {
    mockRpc.mockResolvedValueOnce({ data: [BASE_LEAD], error: null });
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockFrom.mockReturnValueOnce(chain({ insert: { data: null, error: null } }));
    mockSendText.mockResolvedValueOnce(undefined);
    // .from("leads") não configurado → update() lançaria — deve ser engolido

    const result = await runReactivationJob({ now: NOW });

    expect(result).toMatchObject({ sent: 1, failed: 0 });
  });
});

// ---------------------------------------------------------------------------
// Integração: mesmo cron tick, mesmo lead, follow-up seguido de reativação
// nunca resulta em 2 envios no mesmo dia (trava de frequência compartilhada).
// ---------------------------------------------------------------------------

describe("Integração — trava de frequência entre follow-up e reativação no mesmo tick", () => {
  it("lead já recebeu mensagem business-initiated há 1h (via follow-up): reativação bloqueia", async () => {
    // Simula o estado do lead LOGO APÓS o follow-up job ter rodado neste
    // mesmo tick (daily-run roda follow-up antes de reativação, nesta ordem).
    const leadJustMessagedByFollowUp = {
      ...BASE_LEAD,
      last_marketing_sent_at: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    };
    mockRpc.mockResolvedValueOnce({ data: [leadJustMessagedByFollowUp], error: null });

    const result = await runReactivationJob({ now: NOW });

    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: 1, sent: 0 });
  });
});
