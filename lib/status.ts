import { supabaseAdmin } from "@/lib/supabase";
import type {
  LeadStatus,
  ConversationStatus,
  HandoffTo,
} from "@/types/domain";

/**
 * ============================================================================
 * STATUS TRANSITIONS  ponto unico de mudanca de lead_status / conversation_status.
 * ============================================================================
 *
 * REGRA: nenhum outro modulo pode fazer UPDATE direto nesses campos.
 *        Use transitionLeadStatus() e transitionConversationStatus().
 *
 * Transicoes permitidas  lead_status:
 *   NOVO         -> ENGAJADO, PERDIDO
 *   ENGAJADO     -> INTERESSADO, QUENTE, PERDIDO
 *   INTERESSADO  -> QUENTE, ENGAJADO, PERDIDO
 *   QUENTE       -> NEGOCIACAO, INTERESSADO, PERDIDO
 *   NEGOCIACAO   -> FECHADO, PERDIDO, QUENTE
 *   FECHADO      -> (terminal)
 *   PERDIDO      -> ENGAJADO  (reativacao)
 *
 * Transicoes permitidas  conversation_status:
 *   ATIVA              -> AGUARDANDO_HUMANO, PAUSADA, ENCERRADA
 *   AGUARDANDO_HUMANO  -> ATIVA, ENCERRADA
 *   PAUSADA            -> ATIVA, ENCERRADA
 *   ENCERRADA          -> (terminal)
 * ============================================================================
 */

// Guard in-process: rastreia transições em curso no mesmo processo Node.js.
// Node.js é single-threaded — A define o lock ANTES do primeiro await,
// B checa sincronamente e lança ConcurrentTransitionError imediatamente.
// SELECT FOR UPDATE no RPC é o fallback para concorrência entre processos.
const pendingLeadTransitions = new Map<string, true>();

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NOVO:        ["ENGAJADO", "PERDIDO"],
  ENGAJADO:    ["INTERESSADO", "QUENTE", "PERDIDO"],
  INTERESSADO: ["QUENTE", "ENGAJADO", "PERDIDO"],
  QUENTE:      ["NEGOCIACAO", "INTERESSADO", "PERDIDO"],
  NEGOCIACAO:  ["FECHADO", "PERDIDO", "QUENTE"],
  FECHADO:     [],
  PERDIDO:     ["ENGAJADO"],
};

const CONVERSATION_TRANSITIONS: Record<
  ConversationStatus,
  ConversationStatus[]
> = {
  ATIVA:             ["AGUARDANDO_HUMANO", "PAUSADA", "ENCERRADA"],
  AGUARDANDO_HUMANO: ["ATIVA", "ENCERRADA"],
  PAUSADA:           ["ATIVA", "ENCERRADA"],
  ENCERRADA:         [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly kind: "lead_status" | "conversation_status",
    public readonly from: string,
    public readonly to: string
  ) {
    super(`Transicao invalida em ${kind}: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class ConcurrentTransitionError extends Error {
  constructor(kind: string, id: string) {
    super(`Transicao concorrente detectada em ${kind} ${id}`);
    this.name = "ConcurrentTransitionError";
  }
}

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  return LEAD_TRANSITIONS[from].includes(to);
}

export function canTransitionConversation(
  from: ConversationStatus,
  to: ConversationStatus
): boolean {
  if (from === to) return true;
  return CONVERSATION_TRANSITIONS[from].includes(to);
}

/**
 * Faz transicao de lead_status com dupla camada de proteção:
 *
 * 1. Guard in-process (Map): A define lock ANTES do primeiro await.
 *    B checa sincronamente → lança ConcurrentTransitionError sem nenhum
 *    HTTP request. Garante determinismo no teste de integração.
 *
 * 2. SELECT FOR UPDATE no RPC: fallback para concorrência multi-processo
 *    (e.g., duas instâncias serverless diferentes). Se p_from mudou entre
 *    o SELECT inicial e o RPC, o DB rejeita com won=false.
 */
export async function transitionLeadStatus(
  leadId: string,
  to: LeadStatus
): Promise<{ from: LeadStatus; to: LeadStatus; changed: boolean }> {
  // Guard síncrono — executa ANTES do primeiro await
  if (pendingLeadTransitions.has(leadId)) {
    throw new ConcurrentTransitionError("lead_status", leadId);
  }
  pendingLeadTransitions.set(leadId, true);

  try {
    const { data: current, error } = await supabaseAdmin
      .from("leads")
      .select("lead_status")
      .eq("id", leadId)
      .single();

    if (error || !current) throw new Error(`Lead ${leadId} nao encontrado`);

    const from = current.lead_status as LeadStatus;
    if (from === to) return { from, to, changed: false };

    if (!canTransitionLead(from, to)) {
      throw new InvalidTransitionError("lead_status", from, to);
    }

    const { data: won, error: rpcErr } = await supabaseAdmin.rpc(
      "try_transition_lead_status",
      { p_lead_id: leadId, p_from: from, p_to: to }
    );

    if (rpcErr) throw rpcErr;
    if (!won) throw new ConcurrentTransitionError("lead_status", leadId);

    return { from, to, changed: true };
  } finally {
    pendingLeadTransitions.delete(leadId);
  }
}

/**
 * Faz transicao de conversation_status. Permite atualizar handoff_to e
 * assigned_to no mesmo passo. Seta encerrada_em automaticamente ao encerrar.
 */
export async function transitionConversationStatus(
  conversationId: string,
  to: ConversationStatus,
  opts?: { handoff_to?: HandoffTo; assigned_to?: string | null; handoff_topics?: string[] }
): Promise<{
  from: ConversationStatus;
  to: ConversationStatus;
  changed: boolean;
}> {
  const { data: current, error } = await supabaseAdmin
    .from("conversations")
    .select("conversation_status")
    .eq("id", conversationId)
    .single();

  if (error || !current) {
    throw new Error(`Conversation ${conversationId} nao encontrada`);
  }

  const from = current.conversation_status as ConversationStatus;
  const wantsStatusChange = from !== to;

  if (wantsStatusChange && !canTransitionConversation(from, to)) {
    throw new InvalidTransitionError("conversation_status", from, to);
  }

  const update: Record<string, unknown> = {};
  if (wantsStatusChange) update.conversation_status = to;
  if (to === "ENCERRADA") update.encerrada_em = new Date().toISOString();
  if (opts?.handoff_to !== undefined) update.handoff_to = opts.handoff_to;
  if (opts?.assigned_to !== undefined) update.assigned_to = opts.assigned_to;
  if (opts?.handoff_topics !== undefined) update.handoff_topics = opts.handoff_topics;

  if (Object.keys(update).length === 0) {
    return { from, to, changed: false };
  }

  const { error: updErr } = await supabaseAdmin
    .from("conversations")
    .update(update)
    .eq("id", conversationId)
    .eq("conversation_status", from);

  if (updErr) throw updErr;

  if (wantsStatusChange) {
    // PostgREST count/returning unreliable under concurrent writes — verify via fresh SELECT
    const { data: verify, error: verErr } = await supabaseAdmin
      .from("conversations")
      .select("conversation_status")
      .eq("id", conversationId)
      .single();

    if (verErr) throw verErr;
    if (!verify || verify.conversation_status !== to) {
      throw new ConcurrentTransitionError("conversation_status", conversationId);
    }
  }

  return { from, to, changed: wantsStatusChange };
}
