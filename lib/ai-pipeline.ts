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
  type AgentResult,
} from "@/lib/ai";
import { transitionConversationStatus } from "@/lib/status";
import { sendWhatsAppMessage, WhatsAppSendError, PERMANENT_CATEGORIES, type SendErrorCategory } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { calculateLeadScore, type ScoreSource } from "@/lib/lead-scoring";
import { markReactivationResponded } from "@/lib/reactivation";
import { maskPhone } from "@/lib/pii";
import { applyCollectionUpdate } from "@/lib/collection";
import * as Sentry from "@sentry/nextjs";

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
// Redação de PII antes de logar
// ============================================================================

// CPF: 11 dígitos, tipicamente XXX.XXX.XXX-XX mas pode aparecer com pontuação
// parcial ou ausente. Escaneia qualquer string do objeto logado — a estrutura
// (collected_data.financiamento.cpf) não é o único lugar onde pode vazar: a
// LLM pode ecoar o CPF em texto livre (summary, reply_text).
const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const CPF_PLACEHOLDER = "[CPF removido]";

function scrubCpfDeep<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(CPF_PATTERN, CPF_PLACEHOLDER) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubCpfDeep(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubCpfDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}

function redactCpfFromLog(result: AgentResult): unknown {
  // Belt and suspenders: remove o campo estruturado explicitamente...
  const fin = result.collected_data?.financiamento;
  const withoutStructuredCpf =
    !fin || fin.cpf === null || fin.cpf === undefined
      ? result
      : (() => {
          const { cpf: _cpf, ...finRest } = fin;
          return { ...result, collected_data: { ...result.collected_data, financiamento: finRest } };
        })();
  // ...e depois escaneia todo o objeto (inclusive summary/reply_text, texto
  // livre autorado pela LLM) por qualquer substring com formato de CPF.
  return scrubCpfDeep(withoutStructuredCpf);
}

// ============================================================================
// Aviso de IA — transparência LGPD na primeira mensagem da conversa
// ============================================================================
//
// Determinístico por código (não depende de a LLM lembrar de avisar).
// Gatilho: is_new_conversation (webhook_ingest_message, migration 003) —
// dispara em toda thread nova, inclusive reabertura de conversa ENCERRADA.
// autor="sistema": mesmo canal já usado por lib/actions.ts e lib/follow-up.ts
// para texto não-autorado pela LLM. Enviado ANTES da resposta da IA.
//
// Idempotência via messages.meta->>kind="ai_disclosure" (coluna jsonb já
// existente, sem uso prévio) — não por match de texto literal, que quebraria
// se stores.nome mudasse entre uma execução e um reprocessamento (BL-0010/
// BL-0012). meta.sent rastreia se o envio WA teve sucesso: registrado como
// false no insert, atualizado pra true só após sendWhatsAppMessage confirmar
// — evita o inbox mentir "avisado" quando o envio falhou silenciosamente.
// ============================================================================

const AI_DISCLOSURE_KIND = "ai_disclosure" as const;

function buildAiDisclosureText(storeName: string): string {
  return `Você está falando com o atendimento digital da ${storeName}. Sou um assistente virtual e posso te ajudar a encontrar seu veículo, tirar dúvidas e agendar uma visita. Se preferir falar com um vendedor, é só pedir a qualquer momento.`;
}

async function sendAiDisclosureIfNeeded(params: {
  storeId: string;
  conversationId: string;
  leadId: string;
  storeName: string;
  phoneNormalized: string;
}): Promise<void> {
  const text = buildAiDisclosureText(params.storeName);

  // Idempotência: se o pipeline rodar 2x pra mesma conversa nova, não duplica.
  const { data: existing } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("conversation_id", params.conversationId)
    .eq("autor", "sistema")
    .eq("meta->>kind", AI_DISCLOSURE_KIND)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const { data: saved } = await supabaseAdmin
    .from("messages")
    .insert({
      store_id: params.storeId,
      conversation_id: params.conversationId,
      lead_id: params.leadId,
      direcao: "saida",
      autor: "sistema",
      mensagem: text,
      received_at: new Date().toISOString(),
      meta: { kind: AI_DISCLOSURE_KIND, sent: false },
    })
    .select("id")
    .single();

  const disclosureId = saved?.id ?? null;

  try {
    const phoneId = await getStoreWhatsAppPhoneId(params.storeId);
    await sendWhatsAppMessage(params.phoneNormalized, text, phoneId);
    if (disclosureId) {
      await supabaseAdmin
        .from("messages")
        .update({ meta: { kind: AI_DISCLOSURE_KIND, sent: true } })
        .eq("id", disclosureId);
    }
  } catch (e) {
    // Não-fatal pro pipeline: aviso já está no banco com sent=false, refletindo
    // a realidade (mensagem não confirmadamente entregue) — não bloqueia a resposta da IA
    console.error("[ai-disclosure] falha ao enviar aviso de IA:", e);
    Sentry.captureException(e, { tags: { pipeline_stage: "ai_disclosure_send" } });
  }
}

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
    Sentry.captureException(e, { tags: { pipeline_stage: "log_ai_insert" } });
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
  isNewConversation: boolean;
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

    const now = new Date();
    const parsedStart = parseInt(process.env.BUSINESS_HOURS_START ?? "8", 10);
    const parsedEnd = parseInt(process.env.BUSINESS_HOURS_END ?? "18", 10);
    const guardrail = runGuardrails(ctx, {
      businessHoursStart: Number.isFinite(parsedStart) ? parsedStart : 8,
      businessHoursEnd: Number.isFinite(parsedEnd) ? parsedEnd : 18,
      now,
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

    // Aviso de IA — antes de gerar/enviar a resposta comercial
    if (params.isNewConversation) {
      await sendAiDisclosureIfNeeded({
        storeId: params.storeId,
        conversationId: params.conversationId,
        leadId: params.leadId,
        storeName: ctx.store_name,
        phoneNormalized: ctx.lead.phone_normalized,
      });
    }

    const payload = buildPrompt(ctx, guardrail, now);
    const result = await runAgent(payload, ctx);

    // --- Coleta determinística de financiamento/troca ---
    const collection = guardrail.collection ?? null;
    if (collection && (collection.ask.length > 0 || collection.collect.length > 0)) {
      const update = applyCollectionUpdate(ctx.lead.contexto ?? {}, collection, result.collected_data);
      try {
        await supabaseAdmin
          .from("leads")
          .update({
            contexto: update.contexto,
            ...(update.agendamento
              ? {
                  agendamento_data: update.agendamento.data,
                  agendamento_horario: update.agendamento.horario,
                }
              : {}),
          })
          .eq("id", params.leadId);
      } catch (collectionErr) {
        // non-fatal: reply já foi gerado, persistência de coleta não bloqueia resposta
        console.error("[collection] falha ao persistir contexto/agendamento:", collectionErr);
        Sentry.captureException(collectionErr, { tags: { pipeline_stage: "collection_persist" } });
      }
      if (update.forceHandoff) {
        result.should_handoff = true;
      }
    }

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
    const phoneMasked = phone ? maskPhone(phone) : "****";
    let sendFailed = false;
    let sendPermanent = false;
    let sendCategory: SendErrorCategory | null = null;
    try {
      const phoneId = await getStoreWhatsAppPhoneId(params.storeId);
      await sendWhatsAppMessage(ctx.lead.phone_normalized, replyText, phoneId);
      console.log(`[whatsapp-send] mensagem enviada para ${phoneMasked}`);
    } catch (sendErr) {
      sendFailed = true;
      if (sendErr instanceof WhatsAppSendError) {
        sendCategory = sendErr.category;
        sendPermanent = PERMANENT_CATEGORIES.includes(sendErr.category);
        // Logar apenas categoria e status_code — nunca sendErr.message (pode conter PII da Meta)
        console.error(JSON.stringify({
          level: "error",
          event: "whatsapp_send_failed",
          category: sendErr.category,
          status_code: sendErr.statusCode,
          phone: phoneMasked,
          ts: new Date().toISOString(),
        }));
        // Mensagem sintética, nunca sendErr diretamente — sendErr.message pode
        // conter texto vindo da resposta da Meta (mesma cautela do log acima).
        Sentry.captureMessage(
          `whatsapp_send_failed category=${sendErr.category} status=${sendErr.statusCode ?? "?"}`,
          { level: "error", tags: { pipeline_stage: "whatsapp_reply_send", category: sendErr.category } }
        );
      } else {
        console.error("[whatsapp-send] erro inesperado:", sendErr);
        Sentry.captureException(sendErr, { tags: { pipeline_stage: "whatsapp_reply_send" } });
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
      } catch (e) {
        // Reply já salvo; falha na transição não é fatal para o webhook
        Sentry.captureException(e, { tags: { pipeline_stage: "handoff_transition" } });
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
      } catch (e) {
        // non-fatal: reply já salvo, score update não bloqueia resposta
        Sentry.captureException(e, { tags: { pipeline_stage: "score_update" } });
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
      } catch (e) {
        // non-fatal: score é autoritativo, auditoria pode ter gaps no MVP
        Sentry.captureException(e, { tags: { pipeline_stage: "lead_score_events_insert" } });
      }
    }

    // Marcar reativação como respondida se aplicável — non-fatal
    markReactivationResponded(params.leadId).catch((e) =>
      Sentry.captureException(e, { tags: { pipeline_stage: "reactivation_mark_responded" } })
    );

    const finalStatus: AgentStatus = !sendFailed
      ? "ok"
      : sendPermanent
        ? "ok_send_failed_permanent"
        : "ok_send_failed";

    await logAi({
      storeId: params.storeId,
      conversationId: params.conversationId,
      leadId: params.leadId,
      status: finalStatus,
      latencyMs: Date.now() - start,
      model,
      output: redactCpfFromLog(result),
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

    // Falha de pipeline (LLM timeout/parse/output ou erro genérico) — risco
    // conhecido (CURRENT KNOWN RISKS, 27_PROJECT_STATUS.md). store/conversation/
    // lead_id são identificadores internos (UUID), não PII — beforeSend ainda
    // escaneia errorMsg como rede de segurança caso algo vaze por engano.
    Sentry.captureException(e, {
      tags: { pipeline_stage: "run_ai_pipeline", agent_status: agentStatus },
      extra: {
        store_id: params.storeId,
        conversation_id: params.conversationId,
        lead_id: params.leadId,
      },
    });

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
