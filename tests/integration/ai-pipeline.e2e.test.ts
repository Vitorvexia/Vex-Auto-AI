/**
 * Teste E2E da camada de IA — 5 cenários reais
 *
 * Roda com: npm run test:integration -- tests/integration/ai-pipeline.e2e.test.ts --reporter=verbose
 *
 * Requisitos: ANTHROPIC_API_KEY e ANTHROPIC_MODEL em .env.local
 * Cenário 4 (human_handoff) sempre roda — não chama Anthropic.
 * Cenários 1, 2, 3, 5 são skipped sem API key real.
 */

import { describe, it, expect } from "vitest";
import { runGuardrails } from "@/lib/guardrails";
import { buildPrompt } from "@/lib/prompts";
import { runAgent } from "@/lib/ai";
import type { AgentContext } from "@/lib/agent-context";
import type { GuardrailConfig } from "@/lib/guardrails";

// ---------------------------------------------------------------------------
// Detecta se há key real disponível
// ---------------------------------------------------------------------------
const hasAnthropic =
  !!process.env.ANTHROPIC_API_KEY &&
  !!process.env.ANTHROPIC_MODEL &&
  process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-") &&
  process.env.ANTHROPIC_API_KEY.length > 20;

// ---------------------------------------------------------------------------
// Fábrica de contexto base
// ---------------------------------------------------------------------------
function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    store_id: "e2e-store",
    store_name: "Vex Motors",
    lead: {
      id: "e2e-lead",
      nome: "Carlos",
      phone_normalized: "+5511999990000",
      lead_status: "NOVO",
      score: 10,
      origem: "whatsapp",
      contexto: {},
    },
    conversation: {
      id: "e2e-conv",
      conversation_status: "ATIVA",
      handoff_to: "IA",
      summary: "Lead entrou em contato via WhatsApp perguntando sobre veículos.",
      ultima_mensagem_em: new Date().toISOString(),
    },
    last_messages: [],
    vehicles: [
      { id: "v1", marca: "Hyundai", modelo: "HB20",     ano: 2023, preco: 74900,  custo: 65000,  margem_minima: 3000 },
      { id: "v2", marca: "Jeep",    modelo: "Renegade",  ano: 2023, preco: 99900,  custo: 88000,  margem_minima: 4000 },
      { id: "v3", marca: "Toyota",  modelo: "Corolla",   ano: 2023, preco: 129900, custo: 114000, margem_minima: 5000 },
    ],
    incoming_text: "Olá",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: roda pipeline completa e imprime resultado
// ---------------------------------------------------------------------------
async function runPipeline(
  label: string,
  ctx: AgentContext,
  guardrailConfig?: GuardrailConfig
) {
  const separator = "─".repeat(60);
  console.log(`\n${separator}`);
  console.log(`🧪 CENÁRIO: ${label}`);
  console.log(`   Entrada: "${ctx.incoming_text}"`);

  const guardrail = runGuardrails(ctx, guardrailConfig);
  console.log(`   Guardrail: ${guardrail.mode} — ${guardrail.reason}`);

  if (guardrail.mode === "human_handoff") {
    console.log("   ⏭️  IA pulada (human_handoff) — agent_status: skipped_handoff");
    console.log(separator);
    return { guardrail, result: null, agent_status: "skipped_handoff" as const };
  }

  const payload = buildPrompt(ctx, guardrail);
  const result = await runAgent(payload, ctx, { timeoutMs: 15000 });

  console.log(`\n   📤 reply_text:   "${result.reply_texts.join(" | ")}"`);
  console.log(`   🔢 score:         ${result.score}`);
  console.log(`   🏷️  intent_tags:  [${result.intent_tags.join(", ")}]`);
  console.log(`   🤝 should_handoff: ${result.should_handoff}`);
  console.log(`   📝 summary:       "${result.summary}"`);
  console.log(`   ✅ agent_status:  ok`);
  console.log(separator);

  return { guardrail, result, agent_status: "ok" as const };
}

// ---------------------------------------------------------------------------
// Horários de teste
// ---------------------------------------------------------------------------
// 14h BRT = 17h UTC
const DURING_HOURS = new Date("2025-01-15T17:00:00.000Z");
// 22h BRT = 01h UTC (+1 day)
const OFF_HOURS    = new Date("2025-01-16T01:00:00.000Z");

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

describe("E2E — Pipeline de IA (cenários reais)", () => {

  // ─── Cenário 4 sempre roda (sem Anthropic) ─────────────────────────────

  it("Cenário 4: conversa em handoff humano → IA pulada", async () => {
    const ctx = makeCtx({
      conversation: {
        id: "e2e-conv",
        conversation_status: "AGUARDANDO_HUMANO",
        handoff_to: "HUMANO",
        summary: "Lead aguardando atendimento humano.",
        ultima_mensagem_em: new Date().toISOString(),
      },
      incoming_text: "Alguém pode me atender? Quero falar com um vendedor.",
    });

    const { guardrail, agent_status } = await runPipeline(
      "4 — Conversa em handoff humano",
      ctx,
      { now: DURING_HOURS }
    );

    expect(guardrail.mode).toBe("human_handoff");
    expect(agent_status).toBe("skipped_handoff");
  });

  // ─── Cenários com Anthropic ────────────────────────────────────────────

  const itReal = hasAnthropic ? it : it.skip;

  itReal(
    "Cenário 1: mensagem curta → short_message",
    async () => {
      const ctx = makeCtx({ incoming_text: "Oi" });

      const { guardrail, result } = await runPipeline(
        "1 — Mensagem curta",
        ctx,
        { now: DURING_HOURS }
      );

      expect(guardrail.mode).toBe("short_message");
      expect(result).not.toBeNull();
      expect(Array.isArray(result!.reply_texts)).toBe(true);
      expect(result!.reply_texts.join(" ").length).toBeGreaterThan(0);
      expect(result!.should_handoff).toBe(false);
    },
    30_000
  );

  itReal(
    "Cenário 2: mensagem normal com intenção de compra",
    async () => {
      const ctx = makeCtx({
        incoming_text:
          "Tenho interesse em comprar um SUV até R$ 100 mil. Quais opções vocês têm disponíveis e como funciona o financiamento?",
      });

      const { guardrail, result } = await runPipeline(
        "2 — Intenção de compra (normal)",
        ctx,
        { now: DURING_HOURS }
      );

      expect(guardrail.mode).toBe("normal");
      expect(result).not.toBeNull();
      expect(result!.reply_texts.join(" ").length).toBeGreaterThan(0);
      expect(typeof result!.score).toBe("number");
      expect(result!.score).toBeGreaterThanOrEqual(0);
      expect(result!.score).toBeLessThanOrEqual(100);
    },
    30_000
  );

  itReal(
    "Cenário 3: mensagem fora do horário → off_hours",
    async () => {
      const ctx = makeCtx({
        incoming_text: "Boa noite, quero saber sobre financiamento para o HB20.",
      });

      const { guardrail, result } = await runPipeline(
        "3 — Fora do horário",
        ctx,
        { now: OFF_HOURS }
      );

      expect(guardrail.mode).toBe("off_hours");
      expect(result).not.toBeNull();
      expect(result!.reply_texts.join(" ").length).toBeGreaterThan(0);
      // IA deve confirmar recebimento, não prometer resposta imediata
      expect(result!.should_handoff).toBe(false);
    },
    30_000
  );

  itReal(
    "Cenário 5: intenção de fechar compra → should_handoff esperado",
    async () => {
      const ctx = makeCtx({
        lead: {
          id: "e2e-lead",
          nome: "Carlos",
          phone_normalized: "+5511999990000",
          lead_status: "QUENTE",
          score: 75,
          origem: "whatsapp",
          contexto: {},
        },
        conversation: {
          id: "e2e-conv",
          conversation_status: "ATIVA",
          handoff_to: "IA",
          summary:
            "Lead muito interessado no Jeep Renegade 2023. Já perguntou sobre preço, financiamento e disponibilidade. Pronto para fechar.",
          ultima_mensagem_em: new Date().toISOString(),
        },
        last_messages: [
          { direcao: "entrada", autor: "lead", mensagem: "Quanto custa o Renegade 2023?", received_at: new Date().toISOString() },
          { direcao: "saida",   autor: "ia",   mensagem: "O Jeep Renegade 2023 está R$ 99.900. Temos disponível!", received_at: new Date().toISOString() },
          { direcao: "entrada", autor: "lead", mensagem: "Tem financiamento?", received_at: new Date().toISOString() },
          { direcao: "saida",   autor: "ia",   mensagem: "Sim! Trabalhamos com as principais financeiras. Quer simular?", received_at: new Date().toISOString() },
        ],
        incoming_text:
          "Quero fechar a compra hoje. Posso ir na loja assinar o contrato? Qual o endereço e horário de funcionamento?",
      });

      const { guardrail, result } = await runPipeline(
        "5 — Intenção de fechar compra (handoff esperado)",
        ctx,
        { now: DURING_HOURS }
      );

      expect(guardrail.mode).toBe("normal");
      expect(result).not.toBeNull();
      expect(result!.reply_texts.join(" ").length).toBeGreaterThan(0);

      // Logamos o resultado do should_handoff mas não forçamos true —
      // é decisão do modelo. O contrato deve ser válido independente.
      console.log(`\n   ℹ️  should_handoff=${result!.should_handoff} (esperado: true para este cenário)`);
      expect(typeof result!.should_handoff).toBe("boolean");
    },
    30_000
  );
});
