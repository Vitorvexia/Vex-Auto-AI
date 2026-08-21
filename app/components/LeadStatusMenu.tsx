"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/domain";
import { validLeadTargets } from "@/lib/lead-transitions";
import { moveLeadStatus } from "@/lib/actions";

type Props = {
  leadId: string;
  status: LeadStatus;
};

// Mesmos padrões de erro tratados em lib/kanban-drag.tsx (endDrag) — este
// menu chama a mesma Server Action (moveLeadStatus), sujeita às mesmas
// rejeições de servidor (status mudou, transição concorrente).
function moveErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("Transicao invalida")) {
    return "Não foi possível mover — o status do lead mudou. Atualize a página.";
  }
  if (raw.includes("concorrente")) {
    return "Outra pessoa moveu esse lead ao mesmo tempo. Atualize a página.";
  }
  return raw || "Não foi possível mover o lead. Tente novamente.";
}

// Fallback acessível ao drag-and-drop do Kanban (app/components/KanbanColumn.tsx
// + lib/kanban-drag.tsx) — drag por pointer events não é operável via teclado.
// Botão sempre visível no card + menu ARIA (role="menu"/"menuitem") navegável
// por seta cima/baixo, Enter confirma, Esc fecha e devolve foco ao gatilho.
export function LeadStatusMenu({ leadId, status }: Props) {
  const targets = validLeadTargets(status);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  // FECHADO (ou qualquer status terminal futuro) — sem destino possível,
  // menu não faz sentido, mas o card continua abrível via drag ou conversa.
  if (targets.length === 0) return null;

  function closeMenu(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function openMenu() {
    setErrorMsg(null);
    setActiveIndex(0);
    setOpen(true);
  }

  function handleTriggerClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) closeMenu();
    else openMenu();
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openMenu();
    }
  }

  function handleSelect(target: LeadStatus) {
    closeMenu();
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("lead_status", target);
        await moveLeadStatus(leadId, formData);
      } catch (err) {
        setErrorMsg(moveErrorMessage(err));
      }
    });
  }

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % targets.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + targets.length) % targets.length);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(targets[activeIndex]);
      return;
    }
    if (e.key === "Tab") {
      closeMenu(false);
    }
  }

  return (
    // Bloqueia o clique de chegar no <Link> do card (LeadCard.tsx) — este
    // controle é irmão do Link, não filho, mas fica visualmente sobreposto
    // no canto do card.
    <div
      className={`lead-status-menu${isPending ? " is-pending" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="lead-status-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Mover lead para outra etapa"
        disabled={isPending}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        <MoveIcon />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Mover lead para"
          className="lead-status-menu-list"
          onKeyDown={handleMenuKeyDown}
        >
          {targets.map((target, i) => (
            <button
              key={target}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="lead-status-menu-item"
              onClick={() => handleSelect(target)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {LEAD_STATUS_LABELS[target]}
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <span className="lead-status-menu-error" role="alert">
          {errorMsg}
        </span>
      )}
    </div>
  );
}

// Duas setas opostas — mesma leitura visual do "arrow-left-right" (lucide) —
// mais clara de intenção "trocar/mover etapa" que o chevron duplo anterior,
// que lia como cadeado/seta única.
function MoveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}
