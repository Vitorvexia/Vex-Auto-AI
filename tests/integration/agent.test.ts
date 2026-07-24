import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/ai";
import type { PromptPayload } from "@/lib/prompts";
import type { AgentContext } from "@/lib/agent-context";

const hasAnthropic =
  !!process.env.ANTHROPIC_API_KEY &&
  !!process.env.ANTHROPIC_MODEL &&
  process.env.ANTHROPIC_API_KEY !== "dummy";

const describeIf = hasAnthropic ? describe : describe.skip;

function makeCtx(): AgentContext {
  return {
    store_id: "test-store",
    store_name: "Vex Motors Teste",
    lead: {
      id: "test-lead",
      nome: "João Teste",
      phone_normalized: "+5511999999999",
      lead_status: "NOVO",
      score: 0,
      origem: "whatsapp",
      contexto: {},
    },
    conversation: {
      id: "test-conv",
      conversation_status: "ATIVA",
      handoff_to: "IA",
      summary: null,
      ultima_mensagem_em: new Date().toISOString(),
    },
    last_messages: [],
    vehicles: [
      { id: "v1", marca: "Hyundai", modelo: "HB20", ano: 2022, preco: 74900, custo: 65000, margem_minima: 3000 },
    ],
    incoming_text: "Olá, quero saber sobre carros disponíveis",
  };
}

function makePayload(): PromptPayload {
  return {
    system: `[IDENTIDADE]
Você é atendente virtual de uma concessionária chamada Vex Motors Teste.

[TOM DE VOZ]
Seja direto e natural. Máximo 3 a 4 frases.

[FORMATO DE RESPOSTA]
Responda EXCLUSIVAMENTE em JSON válido, sem texto fora do JSON:
{
  "reply_text": "string com resposta ao lead",
  "should_handoff": false,
  "score": 10,
  "intent_tags": [],
  "summary": "resumo da conversa"
}

[REGRAS FIXAS]
- Responda sempre em português
- Respostas curtas e objetivas`,
    messages: [
      { role: "user", content: "Olá, quero saber sobre carros disponíveis" },
    ],
  };
}

describeIf("runAgent — integração real Anthropic", () => {
  it(
    "retorna contrato completo dentro de 5s",
    async () => {
      const ctx = makeCtx();
      const payload = makePayload();

      const result = await runAgent(payload, ctx, { timeoutMs: 5000 });

      expect(typeof result.reply_text).toBe("string");
      expect(result.reply_text.length).toBeGreaterThan(0);
      expect(typeof result.should_handoff).toBe("boolean");
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.intent_tags)).toBe(true);
      expect(typeof result.summary).toBe("string");
    },
    10_000
  );
});
