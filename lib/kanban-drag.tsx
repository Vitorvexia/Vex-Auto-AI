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

type KanbanDragValue = {
  payload: DragPayload | null;
  delta: Delta;
  hoverStatus: LeadStatus | null;
  isPending: boolean;
  beginDrag: (payload: DragPayload, originX: number, originY: number) => void;
  updateDrag: (clientX: number, clientY: number) => void;
  endDrag: () => void;
};

const KanbanDragContext = createContext<KanbanDragValue | null>(null);

export function KanbanDragProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DragPayload | null>(null);
  const [delta, setDelta] = useState<Delta>({ dx: 0, dy: 0 });
  const [hoverStatus, setHoverStatus] = useState<LeadStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const originRef = useRef({ x: 0, y: 0 });
  const hoverStatusRef = useRef<LeadStatus | null>(null);

  const beginDrag = useCallback((p: DragPayload, originX: number, originY: number) => {
    originRef.current = { x: originX, y: originY };
    hoverStatusRef.current = null;
    setPayload(p);
    setDelta({ dx: 0, dy: 0 });
    setHoverStatus(null);
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
      startTransition(async () => {
        const formData = new FormData();
        formData.set("lead_status", target);
        await moveLeadStatus(id, formData);
      });
    }
    setPayload(null);
    setHoverStatus(null);
    setDelta({ dx: 0, dy: 0 });
  }, [payload, startTransition]);

  return (
    <KanbanDragContext.Provider value={{ payload, delta, hoverStatus, isPending, beginDrag, updateDrag, endDrag }}>
      {children}
    </KanbanDragContext.Provider>
  );
}

export function useKanbanDrag(): KanbanDragValue {
  const ctx = useContext(KanbanDragContext);
  if (!ctx) throw new Error("useKanbanDrag precisa estar dentro de KanbanDragProvider");
  return ctx;
}
