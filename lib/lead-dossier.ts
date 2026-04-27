import type { LeadStatus, ConversationStatus } from "@/types/domain";
import type { PriorityTier } from "@/lib/lead-priority";
import { calculateLeadPriority } from "@/lib/lead-priority";
import { relativeTime } from "@/lib/format";

export interface DossierInput {
  lead: {
    id: string;
    nome: string | null;
    lead_status: LeadStatus;
    score: number;
  };
  conversation: {
    summary: string | null;
    ultima_mensagem_em: string;
    conversation_status: ConversationStatus;
  };
  scoreEvents: Array<{
    delta: number;
    reasons: string[];
    created_at: string;
  }>;
  followUpLogs: Array<{
    attempt_number: number;
    status: "sent" | "failed";
  }>;
  reactivationLogs: Array<{
    attempt_number: number;
    status: "sent" | "failed";
  }>;
}

export interface DossierResult {
  lead_name: string;
  priority: PriorityTier;
  priority_label: string;
  recommended_action: string;
  summary: string;
  recent_activity: string;
  intent_signals: string[];
  warnings: string[];
  warningSeverity: "moderate" | "critical" | null;
}

export function buildLeadDossier(input: DossierInput): DossierResult {
  const lead_name = input.lead.nome ?? "Sem nome";
  const summary = input.conversation.summary ?? "Primeiro contato";

  const p = calculateLeadPriority({
    score: input.lead.score,
    conversationStatus: input.conversation.conversation_status,
    leadStatus: input.lead.lead_status,
  });

  const recent_activity = relativeTime(input.conversation.ultima_mensagem_em);

  const intent_signals = input.scoreEvents
    .flatMap(e => (Array.isArray(e.reasons) ? e.reasons : []))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);

  const followUpSent = input.followUpLogs.filter(l => l.status === "sent");
  const reactivSent = input.reactivationLogs.filter(l => l.status === "sent");

  const warnings: string[] = [];
  if (followUpSent.length > 0)
    warnings.push(`${followUpSent.length} follow-up(s) enviado(s) sem resposta`);
  if (reactivSent.length > 0)
    warnings.push(`reativação tentada ${reactivSent.length}x`);

  const warningSeverity: "moderate" | "critical" | null =
    warnings.length === 0
      ? null
      : followUpSent.length >= 3 || reactivSent.length >= 2
      ? "critical"
      : "moderate";

  return {
    lead_name,
    priority: p.priority,
    priority_label: p.priority_label,
    recommended_action: p.recommended_action,
    summary,
    recent_activity,
    intent_signals,
    warnings,
    warningSeverity,
  };
}
