import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hasSupabase, db, createTestStore, deleteStoreDeep, makePhone } from "./helpers";
import { transitionConversationStatus } from "@/lib/status";
import { runGuardrails } from "@/lib/guardrails";
import { buildAgentContext } from "@/lib/agent-context";

const describeIf = hasSupabase ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Roadmap 1.11 — handoff parcial por assunto, cenário real documentado em
// BL-0011 (2026-07-27): "tem desconto nela?" disparou handoff total; a
// pergunta seguinte, "tem quantas 160 no momento?" (estoque, sem relação com
// preço), ficou sem resposta porque o gate era incondicional.
//
// Não chama a Anthropic real (não-determinístico/custo) — simula o efeito já
// coberto isoladamente por tests/unit/ai-pipeline.test.ts (should_handoff=true
// -> transitionConversationStatus com handoff_topics) via write direto no
// banco real, depois valida a decisão do guardrail (runGuardrails) sobre um
// AgentContext lido de volta do banco real via buildAgentContext — round-trip
// completo de handoff_topics: escreve, lê, decide.
// ---------------------------------------------------------------------------

describeIf("Handoff parcial por assunto — cenário real BL-0011 (roadmap 1.11)", () => {
  let storeId: string;

  beforeAll(async () => {
    const store = await createTestStore("handoff-partial");
    storeId = store.id;
  });

  afterAll(async () => {
    await deleteStoreDeep(storeId);
  });

  async function mkLeadAndConv(): Promise<{ leadId: string; conversationId: string }> {
    const { data: lead } = await db
      .from("leads")
      .insert({ store_id: storeId, phone_normalized: makePhone(), origem: "whatsapp" })
      .select("id")
      .single();
    const { data: conv } = await db
      .from("conversations")
      .insert({ store_id: storeId, lead_id: lead!.id, canal: "whatsapp" })
      .select("id")
      .single();
    return { leadId: lead!.id as string, conversationId: conv!.id as string };
  }

  it("HP1: 'tem desconto nela?' aciona handoff parcial (preco_negociacao) via transitionConversationStatus", async () => {
    const { conversationId } = await mkLeadAndConv();

    // Simula o efeito de should_handoff=true no turno 1 (lib/ai-pipeline.ts,
    // já coberto isoladamente em tests/unit/ai-pipeline.test.ts).
    await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
      handoff_topics: ["preco_negociacao"],
    });

    const { data } = await db
      .from("conversations")
      .select("conversation_status, handoff_to, handoff_topics")
      .eq("id", conversationId)
      .single();

    expect(data!.conversation_status).toBe("AGUARDANDO_HUMANO");
    expect(data!.handoff_to).toBe("HUMANO");
    expect(data!.handoff_topics).toEqual(["preco_negociacao"]);
  });

  it("HP2: turno seguinte 'tem quantas 160 no momento?' (estoque) NÃO fica bloqueado — mode normal", async () => {
    const { leadId, conversationId } = await mkLeadAndConv();

    await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
      handoff_topics: ["preco_negociacao"],
    });

    // Lê de volta do banco real — round-trip completo, não mock.
    const ctx = await buildAgentContext({
      storeId,
      leadId,
      conversationId,
      incomingText: "tem quantas 160 no momento?",
    });

    expect(ctx.conversation.handoff_topics).toEqual(["preco_negociacao"]);

    const guardrail = runGuardrails(ctx);

    expect(guardrail.mode).not.toBe("human_handoff");
    expect(guardrail.mode).toBe("normal");
  });

  it("HP3: mensagem que AINDA é sobre o tópico suspenso ('consegue baixar mais?') continua bloqueada", async () => {
    const { leadId, conversationId } = await mkLeadAndConv();

    await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
      handoff_topics: ["preco_negociacao"],
    });

    const ctx = await buildAgentContext({
      storeId,
      leadId,
      conversationId,
      incomingText: "consegue baixar mais um pouco?",
    });

    const guardrail = runGuardrails(ctx);

    expect(guardrail.mode).toBe("human_handoff");
  });

  it("HP4: handoff legado (sem handoff_topics, conversas de antes do deploy) continua bloqueando tudo", async () => {
    const { leadId, conversationId } = await mkLeadAndConv();

    // Sem handoff_topics — mesmo write que o código fazia antes da 1.11.
    await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
    });

    const ctx = await buildAgentContext({
      storeId,
      leadId,
      conversationId,
      incomingText: "tem quantas 160 no momento?",
    });

    expect(ctx.conversation.handoff_topics).toEqual([]);

    const guardrail = runGuardrails(ctx);

    expect(guardrail.mode).toBe("human_handoff");
  });

  it("HP5: returnConversationToAI limpa handoff_topics — próximo turno é normal mesmo pra assunto de preço", async () => {
    const { leadId, conversationId } = await mkLeadAndConv();

    await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
      handoff_topics: ["preco_negociacao"],
    });
    await transitionConversationStatus(conversationId, "ATIVA", {
      handoff_to: "IA",
      handoff_topics: [],
    });

    const ctx = await buildAgentContext({
      storeId,
      leadId,
      conversationId,
      incomingText: "tem desconto nela?",
    });

    const guardrail = runGuardrails(ctx);

    expect(guardrail.mode).toBe("normal");
  });
});
