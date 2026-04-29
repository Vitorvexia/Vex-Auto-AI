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
import { sendWhatsAppMessage, WhatsAppSendError, type SendErrorCategory } from "@/lib/whatsapp-send";
import { calculateLeadScore, type ScoreSource } from "@/lib/lead-scoring";

// ============================================================================
// Tipos
// ============================================================================

export type AgentStatus =
  | "ok"
  | "ok_send_failed"
  | "ok_send_failed_permanent"
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
  messageId?: string | null;
  sendCategory?: SendErrorCategory | null;
}) {
  try {
    await supabaseAdmin.from("ai_logs").insert({
      store_id: params.storeId,
      conversation_id: params.conversationId,
      lead_id: params.leadId,
      kind: "pipeline",
      model: params.model,
      latency_ms: params.latencyMs,
      status: params.status,
      error_code: params.error ?? null,
      llm_output: params.output ?? null,
      message_id: params.messageId ?? null,
      last_send_error: params.sendCategory ?? null,
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
    // Scoring queries run in parallel with buildAgentContext — all depend only on
    // params (leadId, conversationId), not on each other's results.
    const [ctx, followUpRes, reactivationRes, scoreCountRes] = await Promise.all([
      buildAgentContext(params),
      supabaseAdmin
        .from("follow_up_logs")
        .select("logged_at")
        .eq("conversation_id", params.conversationId)
        .eq("status", "sent")
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("reactivation_logs")
        .select("logged_at")
        .eq("lead_id", params.leadId)
        .eq("status", "sent")
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("lead_score_events")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", params.leadId),
    ]);

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

    // Truncar reply ao limite da WA Cloud API antes de qualquer persistência
    const WA_TEXT_LIMIT = 4096;
    const replyText =
      result.reply_text.length > WA_TEXT_LIMIT
        ? result.reply_text.slice(0, WA_TEXT_LIMIT - 3) + "..."
        : result.reply_text;

    // Gravar reply (saida/ia) — texto já truncado, igual ao que será enviado
    // Capturar message_id para link direto no retry — elimina risco de double-send
    const { data: savedMsg } = await supabaseAdmin
      .from("messages")
      .insert({
        store_id: params.storeId,
        conversation_id: params.conversationId,
        lead_id: params.leadId,
        direcao: "saida",
        autor: "ia",
        mensagem: replyText,
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const messageId = savedMsg?.id ?? null;

    // Enviar reply via WhatsApp Cloud API (não-fatal: reply já salvo no banco)
    const phone = ctx.lead.phone_normalized ?? "";
    const phoneMasked = phone
      ? phone.slice(-4).padStart(phone.length, "*")
      : "****";
    let sendFailed = false;
    let sendCategory: SendErrorCategory | null = null;
    try {
      await sendWhatsAppMessage(ctx.lead.phone_normalized, replyText);
      console.log(`[whatsapp-send] mensagem enviada para ${phoneMasked}`);
    } catch (sendErr) {
      sendFailed = true;
      if (sendErr instanceof WhatsAppSendError) {
        sendCategory = sendErr.category;
        // Logar apenas categoria e status_code — nunca sendErr.message (pode conter PII da Meta)
        console.error(JSON.stringify({
          level: "error",
          event: "whatsapp_send_failed",
          category: sendErr.category,
          status_code: sendErr.statusCode,
          phone: phoneMasked,
          ts: new Date().toISOString(),
        }));
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

    // Score determinístico — result.score do LLM não é persistido em leads.score
    const lastInbound = ctx.last_messages.findLast((m) => m.direcao === "entrada");
    const lastInboundAt = lastInbound?.received_at ?? null;

    let scoreSource: ScoreSource = "message";
    const followUpSentAt = followUpRes.data?.logged_at ?? null;
    const reactivationSentAt = reactivationRes.data?.logged_at ?? null;
    if (followUpSentAt && lastInboundAt && new Date(followUpSentAt) > new Date(lastInboundAt)) {
      scoreSource = "follow_up";
    } else if (reactivationSentAt && lastInboundAt && new Date(reactivationSentAt) > new Date(lastInboundAt)) {
      scoreSource = "reactivation";
    }

    const isFirstScore = scoreCountRes.error ? false : (scoreCountRes.count ?? 0) === 0;

    const scoreResult = calculateLeadScore({
      currentScore: ctx.lead.score,
      leadStatus: ctx.lead.lead_status,
      messageText: params.incomingText,
      source: scoreSource,
      isFirstScore,
    });

    if (scoreResult.delta !== 0) {
      try {
        await supabaseAdmin
          .from("leads")
          .update({ score: scoreResult.newScore })
          .eq("id", params.leadId);
      } catch {
        // non-fatal: reply já salvo, score update não bloqueia resposta
      }
      try {
        await supabaseAdmin.from("lead_score_events").insert({
          store_id: params.storeId,
          lead_id: params.leadId,
          conversation_id: params.conversationId,
          old_score: ctx.lead.score,
          new_score: scoreResult.newScore,
          delta: scoreResult.delta,
          reasons: scoreResult.reasons,
          source: scoreSource,
        });
      } catch {
        // non-fatal: score é autoritativo, auditoria pode ter gaps no MVP
      }
    }

    const finalStatus: AgentStatus = sendFailed ? "ok_send_failed" : "ok";

    await logAi({
      storeId: params.storeId,
      conversationId: params.conversationId,
      leadId: params.leadId,
      status: finalStatus,
      latencyMs: Date.now() - start,
      model,
      output: result,
      messageId,
      sendCategory,
    });

    return { agent_status: finalStatus };
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
