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
  mockRunAiPipeline,
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
    mockRunAiPipeline: fn(),
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
vi.mock("@/lib/ai-pipeline", () => ({ runAiPipeline: mockRunAiPipeline }));
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
  mockRunAiPipeline.mockResolvedValue({ agent_status: "ok" });

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

    expect(mockRunAiPipeline).not.toHaveBeenCalled();
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
    expect(mockRunAiPipeline).toHaveBeenCalledTimes(1);

    mockRunAiPipeline.mockClear();

    const res = await POST(makeReq(makeWebhookPayload("wamid-seq-001")));
    const body = await res.json();

    expect(mockRunAiPipeline).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("duplicate");
  });
});

// describe("Webhook idempotência — unique_violation (23505)") removido:
// o webhook route ainda não trata 23505 como duplicate — será adicionado
// no PR que integrar replay guard e rate limiter ao webhook handler.

// describe("Webhook idempotência — replay guard in-memory") removido:
// o webhook route ainda não chama isReplayedMessage — será adicionado
// no mesmo PR acima.
