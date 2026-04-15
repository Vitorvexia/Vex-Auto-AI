import Link from "next/link";
import { relativeTime, scoreClass } from "@/lib/format";
import type { LeadStatus } from "@/types/domain";

type Props = {
  id: string;
  nome: string | null;
  phone_normalized: string;
  score: number;
  lead_status: LeadStatus;
  conversation_id?: string;
  ultima_atividade: string;
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
  nome,
  phone_normalized,
  score,
  conversation_id,
  ultima_atividade,
}: Props) {
  const href    = conversation_id ? `/conversations/${conversation_id}` : "#";
  const sc      = scoreClass(score);
  const urgency = urgencyLevel(ultima_atividade);

  return (
    <Link href={href} className="lead-card">
      <div className="lead-card-top">
        <span className="lead-card-name">{nome ?? "Sem nome"}</span>
        <span className={`score-badge ${sc}`}>{score}</span>
      </div>

      <div className="lead-card-phone">{phone_normalized}</div>

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
  );
}
