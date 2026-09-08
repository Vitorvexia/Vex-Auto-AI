"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { relativeTime, scoreClass } from "@/lib/format";
import type { LeadStatus } from "@/types/domain";
import type { PriorityTier } from "@/lib/lead-priority";
import { LeadAssignmentSelect } from "./LeadAssignmentSelect";
import { LeadStatusMenu } from "./LeadStatusMenu";
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
  const wrapRef = useRef<HTMLDivElement>(null);

  // Distingue clique (abre a conversa) de arraste (move de coluna) sem
  // depender do drag nativo HTML5 — cujo ghost translúcido é o problema
  // que esse componente veio resolver. Threshold em px evita que um
  // tremor de mouse no clique já dispare modo arraste.
  const pressRef = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null);
  const draggedRef = useRef(false);

  // .kanban-col-body tem overflow-y:auto pro scroll da coluna — qualquer
  // elemento "elevado" (position:relative + z-index) que more dentro dela
  // é cortado nas bordas do container durante o drag. Guarda a posição de
  // origem em px de viewport pra desenhar o card arrastado num portal em
  // document.body (position:fixed), fora do overflow de qualquer coluna.
  const originRef = useRef({ left: 0, top: 0, width: 0 });

  // pointermove dispara a cada pixel — atualizar estado do Context (delta +
  // hover column via elementFromPoint) em cada evento saturava a main thread
  // (INP disparou "blocked UI updates" >11s no teste). rAF capa em 1 update
  // por frame, igual todo drag-and-drop custom feito com JS puro.
  const rafRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);

  function flushDrag() {
    rafRef.current = null;
    const p = pendingPointRef.current;
    if (p) drag.updateDrag(p.x, p.y);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".lead-card-tray")) return;
    // Sem isso o browser corre a seleção de texto nativa em paralelo ao
    // drag (mousedown+move seleciona texto por padrão) — fica tudo grifado
    // de azul enquanto arrasta.
    e.preventDefault();
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
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) originRef.current = { left: rect.left, top: rect.top, width: rect.width };
      setIsDragging(true);
      drag.beginDrag({ id, from: lead_status }, press.startX, press.startY);
    }
    pendingPointRef.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushDrag);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const press = pressRef.current;
    pressRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (press?.dragging) {
      // último ponto pode não ter sido flushado ainda — garante hover final
      // correto antes do endDrag decidir se aceita o drop.
      if (pendingPointRef.current) drag.updateDrag(pendingPointRef.current.x, pendingPointRef.current.y);
      draggedRef.current = true;
      drag.endDrag();
      setIsDragging(false);
    }
    pendingPointRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  }

  const cardBody = (
    <>
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
            // <span>, não <button>: o Link inteiro do card já é o alvo do
            // clique/navegação — isso é só o reforço visual do CTA, um
            // <button> aninhado num <a> seria HTML inválido.
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
    </>
  );

  return (
    <>
      <div
        ref={wrapRef}
        className={`lead-card-wrap${vendedores ? " has-move" : ""}${isDragging ? " is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {cardBody}
        {/* Fora do cardBody de propósito: cardBody também é reusado no ghost
            do portal (drag), e duplicar um menu ARIA interativo lá dentro
            criaria dois controles focáveis com o mesmo papel simultâneos no
            DOM. Fallback acessível ao drag — ver LeadStatusMenu.tsx. */}
        <LeadStatusMenu leadId={id} status={lead_status} />
      </div>

      {isDragging && typeof document !== "undefined" && createPortal(
        <div
          className={`lead-card-wrap lead-card-drag-ghost${vendedores ? " has-move" : ""}`}
          style={{
            left: originRef.current.left + drag.delta.dx,
            top: originRef.current.top + drag.delta.dy,
            width: originRef.current.width,
          }}
        >
          {cardBody}
        </div>,
        document.body
      )}
    </>
  );
}
