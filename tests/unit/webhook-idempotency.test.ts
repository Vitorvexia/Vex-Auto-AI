/**
 * Testes de idempotência do webhook WhatsApp.
 *
 * Coberturas:
 * - WAMID duplicado via ingestMessage(duplicate=true) → IA não é chamada
 *
 * Pendente (webhook route ainda não implementa):
 * - unique_violation (23505) tratado como duplicate
 * - replay guard in-memory (isReplayedMessage) integrado ao handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// vi.hoisted() — necessário porque vi.mock() é içado antes das imports
// ---------------------------------------------------------------------------

const {
  mockIngestMessage,
  mockDispatchAiPipeline,
  mockIsReplayedMessage,
  mockCheckRateLimit,
  mockCheckStoreRateLimit,
  mockVerifySignature,
  mockNormalizePhone,
  mockSupabaseFrom,
} = vi.hoisted(() => {
  const fn = vi.fn;
  return {
    mockIngestMessage: fn(),
    mockDispatchAiPipeline: fn(),
    mockIsReplayedMessage: fn(),
    mockCheckRateLimit: fn(),
    mockCheckStoreRateLimit: fn(),
    mockVerifySignature: fn(),
    mockNormalizePhone: fn(),
    mockSupabaseFrom: fn(),
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/ingest", () => ({ ingestMessage: mockIngestMessage }));
vi.mock("@/lib/pipeline-dispatch", () => ({ dispatchAiPipeline: mockDispatchAiPipeline }));
vi.mock("@/lib/replay-guard", () => ({ isReplayedMessage: mockIsReplayedMessage }));
vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
  checkStoreRateLimit: mockCheckStoreRateLimit,
}));
vi.mock("@/lib/whatsapp-signature", () => ({
  verifyMetaSignature: mockVerifySignature,
}));
vi.mock("@/lib/phone", () => ({
  normalizePhone: mockNormalizePhone,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/whatsapp/webhook/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWebhookPayload(messageId: string, from = "11999990000", text = "oi") {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { display_phone_number: "551140004000" },
              contacts: [{ wa_id: from, profile: { name: "Test" } }],
              messages: [
                {
                  id: messageId,
                  from,
                  type: "text",
                  text: { body: text },
                  timestamp: "1700000000",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function makeReq(payload: object) {
  return new NextRequest("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=dummy",
    },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockVerifySignature.mockReturnValue(true);
  // normalizePhone: qualquer entrada retorna um número válido
  mockNormalizePhone.mockImplementation((p: string) =>
    p ? `+5511${p.replace(/\D/g, "").slice(-8)}` : null
  );
  // store lookup
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "store-uuid-1" }, error: null }),
  });

  mockIsReplayedMessage.mockReturnValue(false);
  mockCheckRateLimit.mockReturnValue(true);
  mockCheckStoreRateLimit.mockReturnValue(true);
  mockDispatchAiPipeline.mockResolvedValue({ ran: true, results: [{ agent_status: "ok" }] });

  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("Webhook idempotência — duplicate via ingestMessage", () => {
  it("IA não é invocada quando ingestMessage retorna duplicate=true", async () => {
    mockIngestMessage.mockResolvedValue({
      lead_id: "lead-1",
      conversation_id: "conv-1",
      message_id: null,
      duplicate: true,
      is_new_lead: false,
      is_new_conversation: false,
    });

    const res = await POST(makeReq(makeWebhookPayload("wamid-dup-001")));
    const body = await res.json();

    expect(mockDispatchAiPipeline).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("duplicate");
    expect(body.results[0].agent_status).toBe("skipped_duplicate");
  });

  it("mesma mensagem duas vezes — segunda retorna duplicate sem chamar IA", async () => {
    mockIngestMessage
      .mockResolvedValueOnce({
        lead_id: "lead-1",
        conversation_id: "conv-1",
        message_id: "msg-id-1",
        duplicate: false,
        is_new_lead: true,
        is_new_conversation: true,
      })
      .mockResolvedValueOnce({
        lead_id: "lead-1",
        conversation_id: "conv-1",
        message_id: null,
        duplicate: true,
        is_new_lead: false,
        is_new_conversation: false,
      });

    await POST(makeReq(makeWebhookPayload("wamid-seq-001")));
    expect(mockDispatchAiPipeline).toHaveBeenCalledTimes(1);

    mockDispatchAiPipeline.mockClear();

    const res = await POST(makeReq(makeWebhookPayload("wamid-seq-001")));
    const body = await res.json();

    expect(mockDispatchAiPipeline).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("duplicate");
  });
});

describe("Webhook idempotência — unique_violation (23505)", () => {
  it("23505 tratado como duplicate — IA não é chamada", async () => {
    const err = { code: "23505", message: "duplicate key value violates unique constraint" };
    mockIngestMessage.mockRejectedValue(err);

    const res = await POST(makeReq(makeWebhookPayload("wamid-23505-001")));
    const body = await res.json();

    expect(mockDispatchAiPipeline).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("duplicate");
    expect(body.results[0].agent_status).toBe("skipped_duplicate");
  });

  it("23505 não seta systemicError — ok=true na resposta", async () => {
    const err = { code: "23505", message: "duplicate key value violates unique constraint" };
    mockIngestMessage.mockRejectedValue(err);

    const res = await POST(makeReq(makeWebhookPayload("wamid-23505-002")));
    const body = await res.json();

    expect(body.ok).toBe(true);
  });
});

describe("Webhook — claim de pipeline negado (bugfix concorrência 2026-07-30)", () => {
  it("dispatchAiPipeline.ran=false → agent_status skipped_locked, mensagem não se perde (ok=true)", async () => {
    mockIngestMessage.mockResolvedValue({
      lead_id: "lead-1",
      conversation_id: "conv-1",
      message_id: "msg-1",
      duplicate: false,
      is_new_lead: false,
      is_new_conversation: false,
    });
    mockDispatchAiPipeline.mockResolvedValue({ ran: false, results: [] });

    const res = await POST(makeReq(makeWebhookPayload("wamid-locked-001")));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.results[0].status).toBe("ok"); // ingestMessage salvou normalmente
    expect(body.results[0].agent_status).toBe("skipped_locked");
  });

  it("duas requisições 'simultâneas' pra mesma conversa: a 2ª (claim negado) não roda pipeline de novo — dispatchAiPipeline chamado 2x, mas só 1 processa (ran=true)", async () => {
    mockIngestMessage
      .mockResolvedValueOnce({
        lead_id: "lead-1", conversation_id: "conv-1", message_id: "msg-1",
        duplicate: false, is_new_lead: true, is_new_conversation: true,
      })
      .mockResolvedValueOnce({
        lead_id: "lead-1", conversation_id: "conv-1", message_id: "msg-2",
        duplicate: false, is_new_lead: false, is_new_conversation: false,
      });
    mockDispatchAiPipeline
      .mockResolvedValueOnce({ ran: true, results: [{ agent_status: "ok" }] }) // request A ganha o claim
      .mockResolvedValueOnce({ ran: false, results: [] }); // request B perde o claim

    const resA = await POST(makeReq(makeWebhookPayload("wamid-race-A", "11999990000", "Olá")));
    const resB = await POST(makeReq(makeWebhookPayload("wamid-race-B", "11999990000", "boa noite")));

    expect(mockDispatchAiPipeline).toHaveBeenCalledTimes(2);
    expect((await resA.json()).results[0].agent_status).toBe("ok");
    expect((await resB.json()).results[0].agent_status).toBe("skipped_locked");
  });
});

describe("Webhook idempotência — replay guard in-memory", () => {
  it("isReplayedMessage=true → ingestMessage não é chamado", async () => {
    mockIsReplayedMessage.mockReturnValue(true);

    const res = await POST(makeReq(makeWebhookPayload("wamid-replay-001")));
    const body = await res.json();

    expect(mockIngestMessage).not.toHaveBeenCalled();
    expect(mockDispatchAiPipeline).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("duplicate");
    expect(body.results[0].agent_status).toBe("skipped_duplicate");
  });

  it("isReplayedMessage=true → ok=true, sem systemic error", async () => {
    mockIsReplayedMessage.mockReturnValue(true);

    const res = await POST(makeReq(makeWebhookPayload("wamid-replay-002")));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.results[0].status).toBe("duplicate");
  });
});
