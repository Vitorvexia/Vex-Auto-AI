import type { LeadStatus } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type PriorityTier = "hot" | "warm" | "cold";

export const PRIORITY_ORDER: Record<PriorityTier, number> = {
  hot: 0,
  warm: 1,
  cold: 2,
};

export interface PriorityInput {
  score: number | null | undefined;
  conversationStatus?: string | null;
  leadStatus: LeadStatus; // unused in current logic — reserved for phase 2 decay rules
  ultimaAtividade?: string | null;
}

export interface PriorityResult {
  priority: PriorityTier;
  priority_label: "Quente" | "Morno" | "Frio";
  reasons: string[];
  recommended_action: string;
}

// ============================================================================
// calculateLeadPriority
// ============================================================================

export function calculateLeadPriority(input: PriorityInput): PriorityResult {
  // Explicit null guard — never rely on JS coercion for a business decision
  if (input.score == null) {
    return {
      priority: "cold",
      priority_label: "Frio",
      reasons: ["score_ausente"],
      recommended_action: "Manter nutrição automática",
    };
  }

  const { score, conversationStatus: conv } = input;

  // HOT — short-circuit: score evaluated first, function returns without checking handoff
  if (score >= 80) {
    return {
      priority: "hot",
      priority_label: "Quente",
      reasons: ["score >= 80"],
      recommended_action: "Responder agora / chamar vendedor",
    };
  }
  if (conv === "AGUARDANDO_HUMANO") {
    return {
      priority: "hot",
      priority_label: "Quente",
      reasons: ["handoff_ativo"],
      recommended_action: "Responder agora / chamar vendedor",
    };
  }

  // WARM
  if (score >= 40) {
    return {
      priority: "warm",
      priority_label: "Morno",
      reasons: ["score 40-79"],
      recommended_action: "Continuar atendimento / enviar opções",
    };
  }

  // COLD
  return {
    priority: "cold",
    priority_label: "Frio",
    reasons: ["score < 40"],
    recommended_action: "Manter nutrição automática",
  };
}

// ============================================================================
// sortLeads
// ============================================================================

// Generaliza o cálculo inline de app/leads/page.tsx (staleLeads) — threshold
// configurável em ms pra caber tanto o chip de "/leads" (2h) quanto o alerta
// de "/inicio" (24h) sem duplicar a comparação.
export function countStaleLeads(
  leads: Array<{ ultima_atividade: string }>,
  thresholdMs: number,
  now: Date = new Date()
): number {
  return leads.filter(
    (l) => now.getTime() - new Date(l.ultima_atividade).getTime() > thresholdMs
  ).length;
}

// Escolhe qual ultima_mensagem_em usar pro cálculo de staleness quando um
// lead tem múltiplas conversas (ex: reengajado após reativação). Prioriza
// conversa aberta (status !== ENCERRADA); entre candidatas empatadas (todas
// abertas, ou nenhuma aberta), pega a mais recente por ultima_mensagem_em —
// nunca depende da ordem de retorno da query no banco.
export function pickConversationActivity(
  convs: Array<{ conversation_status: string | null; ultima_mensagem_em: string | null }>
): string | null {
  if (convs.length === 0) return null;
  const open = convs.filter((c) => c.conversation_status && c.conversation_status !== "ENCERRADA");
  const pool = open.length > 0 ? open : convs;
  return pool.reduce<string | null>((latest, c) => {
    if (!c.ultima_mensagem_em) return latest;
    if (!latest || c.ultima_mensagem_em > latest) return c.ultima_mensagem_em;
    return latest;
  }, null);
}

export function sortLeads<
  T extends {
    priority: PriorityTier;
    score: number;
    ultima_atividade: string | null | undefined;
  }
>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.cold;
    const pb = PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.cold;
    if (pa !== pb) return pa - pb;
    if (b.score !== a.score) return b.score - a.score;
    const aTs = a.ultima_atividade ? new Date(a.ultima_atividade).getTime() : 0;
    const bTs = b.ultima_atividade ? new Date(b.ultima_atividade).getTime() : 0;
    return bTs - aTs;
  });
}
