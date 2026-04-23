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

const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
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
 * Faz transicao de lead_status com guarda otimista:
 *   UPDATE ... WHERE id = ? AND lead_status = <from>
 * Se alguem mudou o status em paralelo, lanca ConcurrentTransitionError.
 */
export async function transitionLeadStatus(
  leadId: string,
  to: LeadStatus
): Promise<{ from: LeadStatus; to: LeadStatus; changed: boolean }> {
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

  const { count, error: updErr } = await supabaseAdmin
    .from("leads")
    .update({ lead_status: to }, { count: "exact" })
    .eq("id", leadId)
    .eq("lead_status", from);

  if (updErr) throw updErr;
  if ((count ?? 0) === 0) throw new ConcurrentTransitionError("lead_status", leadId);

  return { from, to, changed: true };
}

/**
 * Faz transicao de conversation_status. Permite atualizar handoff_to e
 * assigned_to no mesmo passo. Seta encerrada_em automaticamente ao encerrar.
 */
export async function transitionConversationStatus(
  conversationId: string,
  to: ConversationStatus,
  opts?: { handoff_to?: HandoffTo; assigned_to?: string | null }
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

  if (Object.keys(update).length === 0) {
    return { from, to, changed: false };
  }

  const { count, error: updErr } = await supabaseAdmin
    .from("conversations")
    .update(update, { count: "exact" })
    .eq("id", conversationId)
    .eq("conversation_status", from);

  if (updErr) throw updErr;
  if ((count ?? 0) === 0) {
    throw new ConcurrentTransitionError("conversation_status", conversationId);
  }

  return { from, to, changed: wantsStatusChange };
}
