"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { relativeTime, scoreClass } from "@/lib/format";
import type { LeadStatus } from "@/types/domain";
import type { PriorityTier } from "@/lib/lead-priority";
import { LeadAssignmentSelect } from "./LeadAssignmentSelect";
import { useKanbanDrag } from "@/lib/kanban-drag";

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

const DRAG_START_THRESHOLD = 6;

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
  const drag = useKanbanDrag();

  // Distingue clique (abre a conversa) de arraste (move de coluna) sem
  // depender do drag nativo HTML5 — cujo ghost translúcido é o problema
  // que esse componente veio resolver. Threshold em px evita que um
  // tremor de mouse no clique já dispare modo arraste.
  const pressRef = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null);
  const draggedRef = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".lead-card-tray")) return;
    pressRef.current = { startX: e.clientX, startY: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const press = pressRef.current;
    if (!press) return;
    const dx = e.clientX - press.startX;
    const dy = e.clientY - press.startY;
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD) return;
      press.dragging = true;
      setIsDragging(true);
      drag.beginDrag({ id, from: lead_status }, press.startX, press.startY);
    }
    drag.updateDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const press = pressRef.current;
    pressRef.current = null;
    if (press?.dragging) {
      draggedRef.current = true;
      drag.endDrag();
      setIsDragging(false);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  }

  const style = isDragging
    ? { transform: `translate3d(${drag.delta.dx}px, ${drag.delta.dy}px, 0) scale(1.045) rotate(-1.5deg)` }
    : undefined;

  return (
    <div
      className={`lead-card-wrap${vendedores ? " has-move" : ""}${isDragging ? " is-dragging" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
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
