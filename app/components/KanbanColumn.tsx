"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { LeadStatus } from "@/types/domain";
import { LEAD_TRANSITIONS, canTransitionLead } from "@/lib/lead-transitions";
import { moveLeadStatus } from "@/lib/actions";
import { DRAG_MIME, dragFromMime, type DragPayload } from "./LeadCard";

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
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<"valid" | "invalid" | null>(null);

  // Fechamento só pela página da conversa (guardrail de margem) — coluna
  // nunca aceita drop, mesma regra que moveLeadStatus já rejeita no server.
  const acceptsDrop = (from: LeadStatus) => status !== "FECHADO" && canTransitionLead(from, status);

  // Origens que esta coluna aceitaria — usado pra sniffar .types durante o
  // drag (getData só é legível em dragstart/drop, não em dragover/dragenter).
  const acceptedFromStatuses = (Object.keys(LEAD_TRANSITIONS) as LeadStatus[]).filter(acceptsDrop);

  const isValidDragTypes = (types: readonly string[]) =>
    acceptedFromStatuses.some((from) => types.includes(dragFromMime(from)));

  const readPayload = (e: React.DragEvent): DragPayload | null => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  };

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
        data-pending={isPending || undefined}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
          // preventDefault sempre (mesmo se inválido) — sem isso o browser
          // recusa o evento drop inteiro e não dá pra mostrar feedback nele.
          e.preventDefault();
          e.dataTransfer.dropEffect = isValidDragTypes(e.dataTransfer.types) ? "move" : "none";
        }}
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
          setDragOver(isValidDragTypes(e.dataTransfer.types) ? "valid" : "invalid");
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(null);
          const payload = readPayload(e);
          if (!payload || !acceptsDrop(payload.from) || payload.from === status) return;
          startTransition(async () => {
            const formData = new FormData();
            formData.set("lead_status", status);
            await moveLeadStatus(payload.id, formData);
          });
        }}
      >
        {children}
      </div>
    </div>
  );
}
