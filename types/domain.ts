export type LeadStatus =
  | "NOVO"
  | "ENGAJADO"
  | "INTERESSADO"
  | "QUENTE"
  | "NEGOCIACAO"
  | "FECHADO"
  | "PERDIDO";

export type ConversationStatus =
  | "ATIVA"
  | "AGUARDANDO_HUMANO"
  | "PAUSADA"
  | "ENCERRADA";

export type HandoffTo = "IA" | "HUMANO";
export type Direcao = "entrada" | "saida";
export type Autor = "lead" | "ia" | "humano" | "sistema";
export type Canal = "whatsapp" | "instagram" | "portal_chat";
export type Origem = "whatsapp" | "portal" | "base_inativa" | "manual";

/** Estados de conversa que ainda nao foram encerrados. */
export const OPEN_CONVERSATION_STATUSES: ConversationStatus[] = [
  "ATIVA",
  "AGUARDANDO_HUMANO",
  "PAUSADA",
];
