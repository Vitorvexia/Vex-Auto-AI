"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import type { LeadStatus } from "@/types/domain";
import { canTransitionLead } from "@/lib/lead-transitions";
import { moveLeadStatus } from "@/lib/actions";

export type DragPayload = { id: string; from: LeadStatus };

// Mesma regra do server (moveLeadStatus rejeita FECHADO) espelhada aqui só
// pra feedback visual — servidor continua sendo a fonte de verdade.
export function acceptsDropStatus(from: LeadStatus, to: LeadStatus): boolean {
  return to !== "FECHADO" && canTransitionLead(from, to);
}

type Delta = { dx: number; dy: number };

// Move em voo — só as colunas from/to dessa transição específica ficam
// "pending" (dimmed + pointer-events:none). Antes um único isPending
// booleano do useTransition travava TODAS as colunas do board durante
// qualquer move, mesmo as sem relação com o drag em andamento.
type PendingMove = { from: LeadStatus; to: LeadStatus };

type KanbanDragValue = {
  payload: DragPayload | null;
  delta: Delta;
  hoverStatus: LeadStatus | null;
  isPending: boolean;
  pendingMove: PendingMove | null;
  dragError: string | null;
  beginDrag: (payload: DragPayload, originX: number, originY: number) => void;
  updateDrag: (clientX: number, clientY: number) => void;
  endDrag: () => void;
  dismissDragError: () => void;
};

const KanbanDragContext = createContext<KanbanDragValue | null>(null);

function dragErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("Transicao invalida") || raw.includes("Invalid")) {
    return "Não foi possível mover — status do lead mudou antes do drop. Atualize a página.";
  }
  if (raw.includes("concorrente") || raw.includes("Concurrent")) {
    return "Outra pessoa moveu esse lead ao mesmo tempo. Atualize a página.";
  }
  return raw || "Não foi possível mover o lead. Tente novamente.";
}

export function KanbanDragProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DragPayload | null>(null);
  const [delta, setDelta] = useState<Delta>({ dx: 0, dy: 0 });
  const [hoverStatus, setHoverStatus] = useState<LeadStatus | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const originRef = useRef({ x: 0, y: 0 });
  const hoverStatusRef = useRef<LeadStatus | null>(null);

  const beginDrag = useCallback((p: DragPayload, originX: number, originY: number) => {
    originRef.current = { x: originX, y: originY };
    hoverStatusRef.current = null;
    setPayload(p);
    setDelta({ dx: 0, dy: 0 });
    setHoverStatus(null);
    setDragError(null);
  }, []);

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    setDelta({ dx: clientX - originRef.current.x, dy: clientY - originRef.current.y });
    const el = document.elementFromPoint(clientX, clientY);
    const col = el?.closest<HTMLElement>("[data-status]");
    const status = (col?.dataset.status as LeadStatus | undefined) ?? null;
    if (status !== hoverStatusRef.current) {
      hoverStatusRef.current = status;
      setHoverStatus(status);
    }
  }, []);

  const endDrag = useCallback(() => {
    const current = payload;
    const target = hoverStatusRef.current;
    if (current && target && target !== current.from && acceptsDropStatus(current.from, target)) {
      const id = current.id;
      const from = current.from;
      setPendingMove({ from, to: target });
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("lead_status", target);
          await moveLeadStatus(id, formData);
        } catch (err) {
          // Servidor é fonte de verdade: se rejeitar (status mudou, transição
          // concorrente etc), o card nunca se moveu de coluna de fato — só o
          // ghost visual do drag, já removido abaixo. Não há RSC pra reverter,
          // só avisar o vendedor pra não achar que a ação "sumiu" em silêncio.
          setDragError(dragErrorMessage(err));
        } finally {
          setPendingMove(null);
        }
      });
    }
    setPayload(null);
    setHoverStatus(null);
    setDelta({ dx: 0, dy: 0 });
  }, [payload, startTransition]);

  const dismissDragError = useCallback(() => setDragError(null), []);

  return (
    <KanbanDragContext.Provider
      value={{ payload, delta, hoverStatus, isPending, pendingMove, dragError, beginDrag, updateDrag, endDrag, dismissDragError }}
    >
      {children}
      {dragError && (
        <div className="kanban-drag-error" role="alert">
          <span>{dragError}</span>
          <button type="button" onClick={dismissDragError} aria-label="Fechar aviso">×</button>
        </div>
      )}
    </KanbanDragContext.Provider>
  );
}

export function useKanbanDrag(): KanbanDragValue {
  const ctx = useContext(KanbanDragContext);
  if (!ctx) throw new Error("useKanbanDrag precisa estar dentro de KanbanDragProvider");
  return ctx;
}
