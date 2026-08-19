"use client";

import type { ReactNode } from "react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/domain";
import { useKanbanDrag, acceptsDropStatus } from "@/lib/kanban-drag";

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
          <span className="kanban-col-title">{LEAD_STATUS_LABELS[status]}</span>
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
