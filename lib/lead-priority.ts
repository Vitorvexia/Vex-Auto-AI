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
