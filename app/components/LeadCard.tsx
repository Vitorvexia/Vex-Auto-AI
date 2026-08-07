import Link from "next/link";
import { relativeTime, scoreClass } from "@/lib/format";
import type { LeadStatus } from "@/types/domain";
import type { PriorityTier } from "@/lib/lead-priority";
import { LEAD_TRANSITIONS } from "@/lib/status";
import { moveLeadStatus } from "@/lib/actions";
import { LeadAssignmentSelect } from "./LeadAssignmentSelect";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: "Novo",
  ENGAJADO: "Engajado",
  INTERESSADO: "Interessado",
  QUENTE: "Quente",
  NEGOCIACAO: "Negociação",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

type Props = {
  id: string;
  nome: string | null;
  phone_normalized: string;
  score: number;
  lead_status: LeadStatus;
  conversation_id?: string;
  ultima_atividade: string;
  priority: PriorityTier;
  priority_label: string;
  assignedTo?: string | null;
  vendedores?: { id: string; nome: string }[];
  canReassign?: boolean;
  interesse?: string | null;
};

type UrgencyLevel = "cooling" | "urgent" | "stale";
const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  cooling: "Resfriando",
  urgent:  "Sem resposta",
  stale:   "Abandonado",
};

function urgencyLevel(ts: string): UrgencyLevel | null {
  const mins = (Date.now() - new Date(ts).getTime()) / 60000;
  if (mins < 30)   return null;
  if (mins < 120)  return "cooling";
  if (mins < 1440) return "urgent";
  return "stale";
}

export function LeadCard({
  id,
  nome,
  phone_normalized,
  score,
  lead_status,
  conversation_id,
  ultima_atividade,
  priority,
  priority_label,
  assignedTo,
  vendedores,
  canReassign,
  interesse,
}: Props) {
  const href        = conversation_id ? `/conversations/${conversation_id}` : "#";
  const sc          = scoreClass(score);
  const urgency     = urgencyLevel(ultima_atividade);
  const transitions = LEAD_TRANSITIONS[lead_status] ?? [];

  return (
    <div className={`lead-card-wrap${transitions.length > 0 ? " has-move" : ""}`}>
      <Link href={href} className="lead-card">
        <div className="lead-card-top">
          <span className="lead-card-name">{nome ?? "Sem nome"}</span>
          <span className={`score-badge ${sc}`}>{score}</span>
        </div>

        {interesse && <div className="lead-card-interesse">{interesse}</div>}

        <div className="lead-card-phone">{phone_normalized}</div>

        <div className={`priority-badge ${priority}`}>{priority_label}</div>

        {urgency && (
          <div className={`urgency-badge ${urgency}`}>{URGENCY_LABEL[urgency]}</div>
        )}

        <div className="lead-card-footer">
          <span className="lead-card-time">{relativeTime(ultima_atividade)}</span>
          {conversation_id && (
            <span className="lead-card-chat">Abrir conversa &rarr;</span>
          )}
        </div>
      </Link>

      {transitions.length > 0 && (
        <form action={moveLeadStatus.bind(null, id)} className="lead-card-move">
          <select name="lead_status" defaultValue="">
            <option value="" disabled>Mover para…</option>
            {transitions.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button type="submit" aria-label="Mover lead">→</button>
        </form>
      )}

      {vendedores && (
        <LeadAssignmentSelect
          leadId={id}
          assignedTo={assignedTo ?? null}
          vendedores={vendedores}
          canReassign={canReassign}
        />
      )}
    </div>
  );
}
