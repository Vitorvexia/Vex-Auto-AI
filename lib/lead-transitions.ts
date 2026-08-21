import type { LeadStatus } from "@/types/domain";

/**
 * Tabela de transições permitidas de lead_status — extraída de lib/status.ts
 * pra ser importável em Client Components (lib/status.ts carrega
 * supabaseAdmin/service_role no topo do módulo, inseguro pro bundle client).
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NOVO:        ["ENGAJADO", "PERDIDO"],
  ENGAJADO:    ["INTERESSADO", "QUENTE", "PERDIDO"],
  INTERESSADO: ["QUENTE", "ENGAJADO", "PERDIDO"],
  QUENTE:      ["NEGOCIACAO", "INTERESSADO", "PERDIDO"],
  NEGOCIACAO:  ["FECHADO", "PERDIDO", "QUENTE"],
  FECHADO:     [],
  PERDIDO:     ["ENGAJADO"],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  return LEAD_TRANSITIONS[from].includes(to);
}

// Etapas de destino válidas a partir de `from`, pra popular menus de troca de
// status (fallback acessível ao drag do Kanban e qualquer UI futura do tipo).
// Mesma exclusão de FECHADO que moveLeadStatus aplica no servidor — fechar
// venda exige vehicle_id + valor_final via página da conversa (guardrail de
// margem), nunca uma simples troca de status.
export function validLeadTargets(from: LeadStatus): LeadStatus[] {
  return LEAD_TRANSITIONS[from].filter((to) => to !== "FECHADO");
}
