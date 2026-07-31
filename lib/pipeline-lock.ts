// ============================================================================
// Lock atômico de conversa pro pipeline de IA — corrige bug de produção
// (Speed Motos, 2026-07-30): duas mensagens do mesmo lead em requests
// separados do webhook disparavam 2 runAiPipeline concorrentes pra mesma
// conversation_id, sem coordenação, gerando respostas sobrepostas.
//
// Claim via RPC no Postgres (UPDATE...WHERE...RETURNING atômico, migration
// 029) — funciona entre processos serverless diferentes. Diferente do lock
// in-process de lib/status.ts (pendingLeadTransitions), que só protege
// dentro do mesmo processo Node.
// ============================================================================

import { supabaseAdmin } from "@/lib/supabase";

// TTL de recuperação de lock órfão. Folga generosa sobre o tempo real de
// execução observado em produção (Vercel logs, deployment do BL-0008: zero
// timeout/5xx nas rotas do pipeline) — não é um valor calibrado por
// necessidade, é intencionalmente alto pra nunca preemptar um turno que
// ainda está rodando de verdade.
export const PIPELINE_LOCK_TTL_SECONDS = 20;

/**
 * Tenta reivindicar o lock de processamento de pipeline para uma conversa.
 * Retorna true se claimed (lock estava livre ou expirado), false se outro
 * processo já detém o lock ainda válido.
 */
export async function claimConversationPipelineLock(
  conversationId: string,
  ttlSeconds: number = PIPELINE_LOCK_TTL_SECONDS
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("claim_conversation_pipeline_lock", {
    p_conversation_id: conversationId,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) throw error;
  return data === true;
}

/**
 * Libera o lock de processamento. Best-effort: falha aqui não deve derrubar
 * o request (o TTL do claim recupera um lock órfão de qualquer forma).
 */
export async function releaseConversationPipelineLock(conversationId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("conversations")
      .update({ pipeline_locked_at: null })
      .eq("id", conversationId);
  } catch {
    // non-fatal — TTL recupera o lock órfão no próximo claim
  }
}
