/**
 * Testes para Patch A — maxRetries: 0 no SDK Anthropic.
 *
 * Root cause: SDK retenta timeouts 2× por padrão (maxRetries=2), fazendo o
 * timeout efetivo chegar a ~27s e ultrapassar o wall da Vercel (10s) antes
 * que o catch block possa executar. Com maxRetries: 0, o AgentTimeoutError
 * é lançado deterministicamente em AGENT_TIMEOUT_MS ms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Captura de argumentos do construtor Anthropic
// ---------------------------------------------------------------------------

let capturedMaxRetries: number | undefined;

// vi.mock é hoistado automaticamente — deve vir antes dos imports do módulo testado.
// Usa importActual para obter a classe real APIConnectionTimeoutError — assim o
// instanceof em callAnthropic funciona corretamente no módulo testado.
vi.mock("@anthropic-ai/sdk", async (importActual) => {
  const actual = await importActual<typeof import("@anthropic-ai/sdk")>();
  const timeoutErr = new actual.APIConnectionTimeoutError();
  return {
    default: vi.fn().mockImplementation((opts: { maxRetries?: number } = {}) => {
      capturedMaxRetries = opts.maxRetries;
      return {
        messages: {
          create: vi.fn().mockRejectedValue(timeoutErr),
        },
      };
    }),
    APIConnectionTimeoutError: actual.APIConnectionTimeoutError,
  };
});

import { runAgent, AgentTimeoutError } from "@/lib/ai";
import type { AgentContext } from "@/lib/agent-context";
import type { PromptPayload } from "@/lib/prompts";

// ---------------------------------------------------------------------------
// Fixtures mínimos
// ---------------------------------------------------------------------------

function makeCtx(): AgentContext {
  return {
    store_id: "s1",
    store_name: "Test Store",
    lead: {
      id: "l1",
      nome: "Test",
      phone_normalized: "+5511999999999",
      lead_status: "NOVO",
      score: 0,
      origem: "whatsapp",
      contexto: {},
    },
    conversation: {
      id: "c1",
      conversation_status: "ATIVA",
      handoff_to: "IA",
      handoff_topics: [],
      summary: null,
      ultima_mensagem_em: new Date().toISOString(),
    },
    last_messages: [],
    vehicles: [],
    incoming_text: "oi",
  };
}

function makePayload(): PromptPayload {
  return {
    system: "test",
    messages: [{ role: "user", content: "oi" }],
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("Patch A — SDK Anthropic com maxRetries: 0", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_MODEL = "claude-3-haiku-20240307";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_MODEL;
    capturedMaxRetries = undefined;
  });

  it("SDK é criado com maxRetries: 0 — retries silenciosos desabilitados", async () => {
    // AgentTimeoutError esperado pois o mock rejeita com APITimeoutError
    await expect(runAgent(makePayload(), makeCtx())).rejects.toBeInstanceOf(AgentTimeoutError);
    expect(capturedMaxRetries).toBe(0);
  });

  it("APITimeoutError do SDK é convertido em AgentTimeoutError", async () => {
    const err = await runAgent(makePayload(), makeCtx()).catch((e) => e);
    expect(err).toBeInstanceOf(AgentTimeoutError);
    expect(err.name).toBe("AgentTimeoutError");
  });
});
