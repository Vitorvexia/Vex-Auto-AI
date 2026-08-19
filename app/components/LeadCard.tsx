"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { relativeTime, scoreClass } from "@/lib/format";
import type { LeadStatus } from "@/types/domain";
import type { PriorityTier } from "@/lib/lead-priority";
import { LeadAssignmentSelect } from "./LeadAssignmentSelect";

export const DRAG_MIME = "application/x-vex-lead";

// dataTransfer.getData() só é legível em dragstart/drop (bloqueado em
// dragover/dragenter por segurança do browser) — o status de origem
// precisa viajar no próprio tipo MIME, que .types expõe durante o drag.
export const dragFromMime = (status: LeadStatus) => `${DRAG_MIME}/from-${status.toLowerCase()}`;

export type DragPayload = { id: string; from: LeadStatus };

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
  const href      = conversation_id ? `/conversations/${conversation_id}` : "#";
  const sc        = scoreClass(score);
  const urgency   = urgencyLevel(ultima_atividade);
  const initial   = (nome ?? "?").trim().charAt(0).toUpperCase() || "?";
  const [isDragging, setIsDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapRef}
      className={`lead-card-wrap${vendedores ? " has-move" : ""}${isDragging ? " is-dragging" : ""}`}
      draggable
      onDragStart={(e) => {
        const payload: DragPayload = { id, from: lead_status };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.setData(dragFromMime(lead_status), "");
        e.dataTransfer.effectAllowed = "move";

        // Ghost nativo do browser é translúcido e some junto com o card
        // original ainda visível — dá efeito de "clone fantasma parado".
        // Clone opaco fora da tela como drag image resolve os dois:
        // imagem sólida seguindo o cursor + card real escondido via CSS.
        const node = wrapRef.current;
        if (node) {
          const rect = node.getBoundingClientRect();
          const clone = node.cloneNode(true) as HTMLDivElement;
          clone.style.position = "fixed";
          clone.style.top = "-9999px";
          clone.style.left = "-9999px";
          clone.style.width = `${rect.width}px`;
          clone.style.opacity = "1";
          clone.style.transform = "none";
          clone.style.pointerEvents = "none";
          document.body.appendChild(clone);
          e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top);
          setTimeout(() => document.body.removeChild(clone), 0);
        }

        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
    >
      <Link href={href} className="lead-card" draggable={false}>
        <div className="lead-card-top">
          <div className="lead-card-identity">
            <span className="lead-card-avatar" data-priority={priority}>{initial}</span>
            <span className="lead-card-name">{nome ?? "Sem nome"}</span>
          </div>
          <span className={`score-badge ${sc}`}>{score}</span>
        </div>

        {interesse && <div className="lead-card-interesse">{interesse}</div>}

        <div className="lead-card-phone">{phone_normalized}</div>

        <div className="lead-card-badges">
          <span className={`priority-badge ${priority}`}>{priority_label}</span>
          {urgency && (
            <span className={`urgency-badge ${urgency}`}>{URGENCY_LABEL[urgency]}</span>
          )}
        </div>

        <div className="lead-card-footer">
          <span className="lead-card-time">{relativeTime(ultima_atividade)}</span>
          {conversation_id && (
            <span className="lead-card-chat">Abrir conversa &rarr;</span>
          )}
        </div>
      </Link>

      {vendedores && (
        <div className="lead-card-tray">
          <LeadAssignmentSelect
            leadId={id}
            assignedTo={assignedTo ?? null}
            vendedores={vendedores}
            canReassign={canReassign}
          />
        </div>
      )}
    </div>
  );
}
