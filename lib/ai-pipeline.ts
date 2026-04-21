// ============================================================================
// Pipeline de IA — núcleo do processamento de mensagens WhatsApp
//
// Extraído de app/api/whatsapp/webhook/route.ts para permitir testes unitários.
// ============================================================================

import { supabaseAdmin } from "@/lib/supabase";
import { buildAgentContext } from "@/lib/agent-context";
import { runGuardrails } from "@/lib/guardrails";
import { buildPrompt } from "@/lib/prompts";
import {
  runAgent,
  AgentTimeoutError,
  AgentParseError,
  AgentOutputError,
} from "@/lib/ai";
import { transitionConversationStatus } from "@/lib/status";
import { sendWhatsAppMessage, WhatsAppSendError } from "@/lib/whatsapp-send";

// ============================================================================
// Tipos
// ============================================================================

export type AgentStatus =
  | "ok"
  | "skipped_handoff"
  | "skipped_duplicate"
  | "timeout"
  | "parse_error"
  | "output_error"
  | "error";

// ============================================================================
// ai_logs helper
// ============================================================================

export async function logAi(params: {
  storeId: string;
  conversationId: string;
  leadId: string;
  status: AgentStatus;
  latencyMs: number;
  model: string | null;
  output?: unknown;
  error?: string;
}) {
  try {
    await supabaseAdmin.from("ai_logs").insert({
      store_id: params.storeId,
      conversation_id: params.conversationId,
      lead_id: params.leadId,
      model: params.model,
      latency_ms: params.latencyMs,
      status: params.status,
      error_code: params.error ?? null,
      llm_output: params.output ?? null,
    });
  } catch (e) {
    // ai_logs failure must never break the webhook response
    console.error("[ai_logs] falha ao gravar log:", e);
  }
}

// ============================================================================
// Pipeline de IA
// ============================================================================

export async function runAiPipeline(params: {
  storeId: string;
  leadId: string;
  conversationId: string;
  incomingText: string;
}): Promise<{ agent_status: AgentStatus; error?: string }> {
  const start = Date.now();
  const model = process.env.ANTHROPIC_MODEL ?? null;

  try {
    const ctx = await buildAgentContext(params);

    const parsedStart = parseInt(process.env.BUSINESS_HOURS_START ?? "8", 10);
    const parsedEnd = parseInt(process.env.BUSINESS_HOURS_END ?? "18", 10);
    const guardrail = runGuardrails(ctx, {
      businessHoursStart: Number.isFinite(parsedStart) ? parsedStart : 8,
      businessHoursEnd: Number.isFinite(parsedEnd) ? parsedEnd : 18,
    });

    // Handoff ativo: logar skipped_handoff e retornar sem resposta de IA
    if (guardrail.mode === "human_handoff") {
      await logAi({
        storeId: params.storeId,
        conversationId: params.conversationId,
        leadId: params.leadId,
        status: "skipped_handoff",
        latencyMs: Date.now() - start,
        model,
      });
      return { agent_status: "skipped_handoff" };
    }

    const payload = buildPrompt(ctx, guardrail);
    const result = await runAgent(payload, ctx);

    // Gravar reply (saida/ia)
    await supabaseAdmin.from("messages").insert({
      store_id: params.storeId,
      conversation_id: params.conversationId,
      lead_id: params.leadId,
      direcao: "saida",
      autor: "ia",
      mensagem: result.reply_text,
      received_at: new Date().toISOString(),
    });

    // Enviar reply via WhatsApp Cloud API (não-fatal: reply já salvo no banco)
    try {
      await sendWhatsAppMessage(ctx.lead.phone_normalized, result.reply_text);
      console.log(`[whatsapp-send] mensagem enviada para ${ctx.lead.phone_normalized}`);
    } catch (sendErr) {
      if (sendErr instanceof WhatsAppSendError) {
        console.error(`[whatsapp-send] falha ao enviar para ${ctx.lead.phone_normalized}: ${sendErr.message}`);
      } else {
        console.error("[whatsapp-send] erro inesperado:", sendErr);
      }
      // Não propaga: reply já está no banco, pipeline continua
    }

    // should_handoff=true → reply já gravado → transicionar sem nova resposta
    if (result.should_handoff) {
      try {
        await transitionConversationStatus(
          params.conversationId,
          "AGUARDANDO_HUMANO",
          { handoff_to: "HUMANO" }
        );
      } catch {
        // Reply já salvo; falha na transição não é fatal para o webhook
      }
    }

    // Atualizar score se mudou (falha não é fatal — reply já foi salvo)
    if (result.score !== ctx.lead.score) {
      try {
        await supabaseAdmin
          .from("leads")
          .update({ score: result.score })
          .eq("id", params.leadId);
      } catch {
        // Score update não impede a resposta ao lead
      }
    }

    await logAi({
      storeId: params.storeId,
      conversationId: params.conversationId,
      leadId: params.leadId,
      status: "ok",
      latencyMs: Date.now() - start,
      model,
      output: result,
    });

    return { agent_status: "ok" };
  } catch (e: unknown) {
    let agentStatus: AgentStatus = "error";
    if (e instanceof AgentTimeoutError) agentStatus = "timeout";
    else if (e instanceof AgentParseError) agentStatus = "parse_error";
    else if (e instanceof AgentOutputError) agentStatus = "output_error";

    const errorMsg = e instanceof Error ? e.message : String(e);

    await logAi({
      storeId: params.storeId,
      conversationId: params.conversationId,
      leadId: params.leadId,
      status: agentStatus,
      latencyMs: Date.now() - start,
      model,
      error: errorMsg,
    });

    return { agent_status: agentStatus, error: errorMsg };
  }
}
