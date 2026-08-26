// ============================================================================
// Detecção de opt-out de marketing (BL-0040/DL-0021).
//
// Determinístico por código — mesma filosofia do guardrail de margem e do
// guardrail de idade: regra inegociável, nunca confiada à LLM.
// ============================================================================

import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import * as Sentry from "@sentry/nextjs";

// Match exato da mensagem inteira (normalizada) — não substring. Um
// substring match faria "para de vender essa moto" disparar por conter
// "para", que é falso-positivo (o lead não pediu opt-out, só está negociando).
const OPT_OUT_PHRASES = new Set([
  "para",
  "pare",
  "nao quero mais",
  "descadastrar",
  "sair da lista",
  "nao me manda mais",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (após NFD) — mesmo padrão de lib/ai-pipeline.ts (scrubCpfDeep)
    .toLowerCase()
    .trim()
    .replace(/[!.?,;]+$/g, "")
    .trim();
}

export function isOptOutRequest(text: string): boolean {
  if (!text) return false;
  return OPT_OUT_PHRASES.has(normalize(text));
}

/**
 * Detecta e persiste opt-out se a mensagem casar. Não-fatal — nunca lança;
 * falha de escrita vai pro Sentry (mesmo padrão de lib/audit.ts). Só afeta
 * elegibilidade de mensagens business-initiated (follow-up/reativação) via
 * canSendMarketingMessage — nunca bloqueia a resposta normal da IA dentro
 * da conversa.
 */
export async function applyOptOutIfDetected(params: {
  leadId: string;
  storeId: string;
  text: string;
}): Promise<boolean> {
  if (!isOptOutRequest(params.text)) return false;

  try {
    const { error } = await supabaseAdmin
      .from("leads")
      .update({
        marketing_opt_out: true,
        marketing_opt_out_at: new Date().toISOString(),
      })
      .eq("id", params.leadId);

    if (error) throw error;

    await logAudit({
      storeId: params.storeId,
      userId: null,
      action: "lead.marketing_opt_out",
      resourceType: "lead",
      resourceId: params.leadId,
    });

    return true;
  } catch (e) {
    Sentry.captureException(e, { tags: { pipeline_stage: "marketing_opt_out" } });
    return false;
  }
}
