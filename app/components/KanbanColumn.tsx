import type { ReactNode } from "react";
import type { LeadStatus } from "@/types/domain";

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
  return (
    <div className="kanban-col" data-status={status}>
      <div className="kanban-col-header">
        <div className="kanban-col-title-row">
          <span className="kanban-col-dot" />
          <span className="kanban-col-title">{STATUS_LABELS[status]}</span>
        </div>
        <span className="kanban-col-count">{count}</span>
      </div>
      <div className="kanban-col-body">{children}</div>
    </div>
  );
}
