// ============================================================================
// Dispatch do pipeline de IA com claim atômico por conversa — corrige bug de
// produção (Speed Motos, 2026-07-30): mensagens do mesmo lead chegando em
// requests separados do webhook disparavam runAiPipeline concorrentes pra
// mesma conversation_id (nenhum lock existia antes disso).
//
// Fluxo:
//   claim falhou  → não roda pipeline aqui; mensagem já está salva
//                    (ingestMessage já rodou antes do dispatch) — quem
//                    detém o lock vai pegá-la no dreno.
//   claim ganhou  → dreno: concatena toda entrada ainda sem resposta,
//                    roda runAiPipeline 1x pro lote, rechecha se chegou
//                    mensagem nova durante o processamento, repete se sim.
//
// Corte de "não respondida" usa created_at (clock do nosso Postgres, mesmo
// domínio pra entrada e saida) — NUNCA received_at (timestamp do lado do
// lead/Meta): a resposta da IA pode ser inserida com received_at "agora"
// vários segundos DEPOIS do received_at de uma mensagem que chegou enquanto
// o LLM processava, o que faria a comparação por received_at classificar
// essa mensagem como "anterior" à resposta mesmo sem ter sido respondida.
// ============================================================================

import { supabaseAdmin } from "@/lib/supabase";
import { runAiPipeline, type AgentStatus } from "@/lib/ai-pipeline";
import { claimConversationPipelineLock, releaseConversationPipelineLock } from "@/lib/pipeline-lock";

// Status que significam "uma linha saida foi de fato inserida em messages"
// (mesmo que o ENVIO tenha falhado — insert acontece antes do envio, é o
// invariante de todo o pipeline). Só nesses casos faz sentido rechecar por
// mensagem nova: o cursor (created_at da última saida) avançou de verdade.
const REPLY_PRODUCED_STATUSES = new Set<AgentStatus>([
  "ok",
  "ok_send_failed",
  "ok_send_failed_permanent",
]);

// Teto de segurança pro loop de dreno — nunca deveria ser atingido em uso
// normal (cada iteração exige uma mensagem NOVA que chegou durante a
// anterior), mas evita loop sem limite em qualquer cenário não previsto.
const MAX_DRAIN_ITERATIONS = 10;

// parse_error/output_error são falhas de FORMATAÇÃO da LLM (ela respondeu,
// só não respeitou o schema JSON) — evidência real de produção (2026-07-31)
// mostra o mesmo texto de entrada tendo sucesso numa tentativa seguinte.
// Achado: sem NENHUM retry em lugar nenhum do sistema (nem aqui, nem no cron
// retry-failed.ts, que só cobre ok_send_failed), uma falha de formatação
// deixava o lead mudo até ele mandar mensagem nova — 8h30 de silêncio num
// caso real. timeout/error/skipped_handoff ficam de fora do retry: timeout
// já consumiu ~8s (AGENT_TIMEOUT_MS) do orçamento apertado da Vercel Hobby
// (~10s), repetir arriscaria estourar o request; error é genérico demais
// pra assumir que é transitório; skipped_handoff é decisão intencional do
// guardrail, não falha.
const RETRIABLE_STATUSES = new Set<AgentStatus>(["parse_error", "output_error"]);
const MAX_FORMAT_RETRIES = 1; // 1 retry = 2 tentativas totais por lote

export interface DispatchResult {
  ran: boolean;
  results: Array<{ agent_status: AgentStatus; error?: string }>;
}

async function getUnansweredIncomingText(conversationId: string): Promise<string | null> {
  const { data: lastSaida } = await supabaseAdmin
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direcao", "saida")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabaseAdmin
    .from("messages")
    .select("mensagem, created_at")
    .eq("conversation_id", conversationId)
    .eq("direcao", "entrada")
    .order("created_at", { ascending: true });

  if (lastSaida?.created_at) {
    query = query.gt("created_at", lastSaida.created_at);
  }

  const { data: pending } = await query;

  if (!pending || pending.length === 0) return null;

  return pending.map((m: { mensagem: string }) => m.mensagem).join("\n");
}

export async function dispatchAiPipeline(params: {
  storeId: string;
  leadId: string;
  conversationId: string;
  isNewConversation: boolean;
}): Promise<DispatchResult> {
  const claimed = await claimConversationPipelineLock(params.conversationId);
  if (!claimed) {
    return { ran: false, results: [] };
  }

  const results: Array<{ agent_status: AgentStatus; error?: string }> = [];

  try {
    for (let i = 0; i < MAX_DRAIN_ITERATIONS; i++) {
      const incomingText = await getUnansweredIncomingText(params.conversationId);
      if (!incomingText) break;

      const runArgs = {
        storeId: params.storeId,
        leadId: params.leadId,
        conversationId: params.conversationId,
        incomingText,
        isNewConversation: i === 0 && params.isNewConversation,
      };

      let result = await runAiPipeline(runArgs);
      let formatRetries = 0;
      // Retenta com o MESMO incomingText — nunca re-consulta o banco no
      // meio da tentativa, pra não misturar mensagem nova que chegou
      // durante o retry com o lote que já estava em processamento.
      while (RETRIABLE_STATUSES.has(result.agent_status) && formatRetries < MAX_FORMAT_RETRIES) {
        formatRetries++;
        result = await runAiPipeline(runArgs);
      }
      results.push(result);

      // Sem reply produzida (timeout/parse/output/erro genérico/handoff) —
      // a mensagem continua sem resposta no banco, mas repetir na hora, sem
      // backoff, só multiplicaria custo de LLM e risco de estourar o tempo
      // do request. Fica pra próxima mensagem real do lead reabrir o ciclo.
      if (!REPLY_PRODUCED_STATUSES.has(result.agent_status)) break;
    }
  } finally {
    await releaseConversationPipelineLock(params.conversationId);
  }

  return { ran: true, results };
}
