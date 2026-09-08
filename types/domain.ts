export type LeadStatus =
  | "NOVO"
  | "ENGAJADO"
  | "INTERESSADO"
  | "QUENTE"
  | "NEGOCIACAO"
  | "FECHADO"
  | "PERDIDO";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: "Novo",
  ENGAJADO: "Engajado",
  INTERESSADO: "Interessado",
  QUENTE: "Quente",
  NEGOCIACAO: "Negociação",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

export type ConversationStatus =
  | "ATIVA"
  | "AGUARDANDO_HUMANO"
  | "PAUSADA"
  | "ENCERRADA";

export type HandoffTo = "IA" | "HUMANO";
export type Direcao = "entrada" | "saida";
export type Autor = "lead" | "ia" | "humano" | "sistema";
export type Canal = "whatsapp" | "instagram" | "portal_chat";
export type Origem = "whatsapp" | "portal" | "base_inativa" | "manual" | "site";

export interface Lead {
  id: string;
  nome: string | null;
  phone_normalized: string;
  score: number;
  lead_status: LeadStatus;
  assigned_to: string | null;       // UUID of responsible vendor. NULL = no owner
  conversation_status?: string | null; // active conversation status — used for hot-via-handoff detection
  updated_at: string;
  valor_final?: number | null;
}

/** Estados de conversa que ainda nao foram encerrados. */
export const OPEN_CONVERSATION_STATUSES: ConversationStatus[] = [
  "ATIVA",
  "AGUARDANDO_HUMANO",
  "PAUSADA",
];
