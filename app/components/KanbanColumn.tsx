"use client";

import type { ReactNode } from "react";
import type { LeadStatus } from "@/types/domain";
import { useKanbanDrag, acceptsDropStatus } from "@/lib/kanban-drag";

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
  status: LeadStatus;
  count: number;
  children: ReactNode;
};

export function KanbanColumn({ status, count, children }: Props) {
  const drag = useKanbanDrag();

  const isHovering = drag.payload !== null && drag.hoverStatus === status;
  const dragOver = isHovering
    ? (acceptsDropStatus(drag.payload!.from, status) ? "valid" : "invalid")
    : null;

  return (
    <div className="kanban-col" data-status={status}>
      <div className="kanban-col-header">
        <div className="kanban-col-title-row">
          <span className="kanban-col-dot" />
          <span className="kanban-col-title">{STATUS_LABELS[status]}</span>
        </div>
        <span className="kanban-col-count">{count}</span>
      </div>
      <div
        className="kanban-col-body"
        data-drag-over={dragOver ?? undefined}
        data-pending={drag.isPending || undefined}
      >
        {children}
      </div>
    </div>
  );
}
